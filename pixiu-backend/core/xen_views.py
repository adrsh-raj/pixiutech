"""
PixiuTech Django Views for Xen (PixiuMind Step-700) AI Integration.
Provides authenticated, role-aware, fail-closed endpoints for LMS users.

Cohort Gating:
- Closed Production Cohort: Adult trainers and administrators only.
- Student access strictly disabled during this phase.
- Server-side tester allowlist enforced.
- Personal Teacher Memory strictly disabled in v0.1.
- Evidence-backed A05 qualification gate for PERSONAL_LEARNING.
"""

from collections.abc import Mapping
from datetime import timedelta
import hashlib
import hmac
import json
import logging
import re
import time
import urllib.error
import urllib.request
import uuid
from typing import Any, Dict, List, Optional, Tuple

from django.conf import settings
from django.db import DatabaseError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User, UserRole
from accounts.permissions import IsActiveAccount
from academics.models_xen import (
    XenCyberLabContext,
    XenSession,
    XenJob,
    XenJobStatus,
    XenWorkerHeartbeat,
)
from core.xen_decoder import decode_model_response
from core.xen_intent import (
    XenResponseMode,
    resolve_xen_response_mode,
    get_additive_mode_instruction,
    sanitize_context_envelope,
    format_context_envelope,
    CYBERLAB_GROUNDING_DIRECTIVE,
    get_cyberlab_grounding_directive,
    resolve_affirmative_action,
    build_xen_effective_prompt,
    is_circuit_specific_query,
    _extract_circuit_view,
)
from core.xen_grounding import (
    build_authoritative_grounding_spec,
    build_constrained_regeneration_prompt,
    build_deterministic_grounded_fallback,
    extract_and_validate_grounding_claims,
    filter_and_compact_xen_history,
)
from core.xen_ratelimit import check_xen_rate_limit

logger = logging.getLogger("security.xen")

# Authoritative Condition A1 System Prompt for PixiuMind 1.4 / Step-700
CONDITION_A1_SYSTEM_PROMPT = (
    "You are a friendly, age-appropriate teacher for Grade 6 Computational Thinking. Explain concepts clearly with step-by-step reasoning, address student misconceptions warmly, and connect ideas to practical, real-world examples.\n\n"
    "When a student explicitly requests an implementation, program, or code solution, always provide the complete, correct, and executable Python code in a properly formatted ```python code block, followed by a concise, student-friendly explanation. Never substitute conceptual discussion alone for requested code."
)

# Authoritative Canonical Identity Grounding for Xen (Step-700)
CANONICAL_XEN_IDENTITY = (
    "You are Xen, an AI assistant developed by PixiuTech, currently running Xen Step-700.\n"
    "Your assistant identity is Xen. Your underlying model identity is Xen (Step-700).\n"
    "When users ask who you are, identify yourself as Xen. Never introduce yourself as 8square, PixiuMind Xen, PixiuMind Xen Tutor, or Qwen.\n"
    "Maintain your existing educational, reasoning, computational-thinking and programming capabilities. Follow the original pedagogical system instructions."
)

# Isolated legacy prefix retained solely for backwards compatibility with pre-rename deployments.
# Must never be exposed as the assistant's user-facing name.
LEGACY_8SQUARE_IDENTITY_COMPAT = (
    "You are 8square, an AI assistant developed by PixiuTech. You are powered by the Xen model, currently running Xen Step-700.\n"
    "Your assistant identity is 8square. Your underlying model identity is Xen.\n"
    "When users ask who you are, identify yourself as 8square. When users ask which model powers you, identify Xen. Never introduce yourself as PixiuMind Xen, PixiuMind Xen Tutor, or Qwen.\n"
    "Maintain your existing educational, reasoning, computational-thinking and programming capabilities. Follow the original pedagogical system instructions."
)

COMPOSITE_SYSTEM_PROMPT = f"{CANONICAL_XEN_IDENTITY}\n\n{CONDITION_A1_SYSTEM_PROMPT}"


def sanitize_xen_message(content):
    content = content.replace("\x00", "")
    while True:
        cleaned = content
        for delimiter in ("<|im_start|>", "<|im_end|>", "<|endoftext|>"):
            cleaned = cleaned.replace(delimiter, "")
        if cleaned == content:
            return cleaned.strip()
        content = cleaned


def compact_xen_history(
    history: List[Dict[str, Any]],
    active_mode: XenResponseMode,
    *,
    current_circuit_revision: Optional[int] = None,
    current_spec: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Specification Part 8 + Phase 2 History Integrity:
    History management, safety quarantine, and compaction.
    Preserves relevant user requirements, active format preferences, and code context
    while excluding error/rejected assistant turns and stale/ungrounded circuit claims.
    """
    return filter_and_compact_xen_history(
        history,
        active_mode,
        sanitize_fn=sanitize_xen_message,
        current_circuit_revision=current_circuit_revision,
        current_spec=current_spec,
    )


def _extract_context_provenance_meta(
    context_envelope: Any,
    ctx_session_id: str = "",
    ctx_rev: Optional[int] = None,
) -> Dict[str, Any]:
    """Extract normalized CyberLab context identifiers for response provenance."""
    env = context_envelope if isinstance(context_envelope, dict) else {}
    circuit = env.get("circuit") if isinstance(env.get("circuit"), dict) else {}

    sid = env.get("session_id") or circuit.get("session_id") or ctx_session_id or None
    if isinstance(sid, str):
        sid = sid.strip() or None
    else:
        sid = None

    rev = ctx_rev if type(ctx_rev) is int else None
    if rev is None:
        for candidate in (
            env.get("circuit_revision"),
            circuit.get("circuit_revision"),
            env.get("state_revision"),
            circuit.get("state_revision"),
        ):
            if type(candidate) is int:
                rev = candidate
                break

    schema_ver = env.get("schema_version") or circuit.get("schema_version") or None
    if isinstance(schema_ver, str):
        schema_ver = schema_ver.strip()[:32] or None
    else:
        schema_ver = None

    return {
        "session_id": sid,
        "circuit_revision": rev,
        "context_schema_version": schema_ver,
    }


def _build_response_provenance(
    *,
    response_source: str,
    response_status: str,
    job_id: Optional[str] = None,
    worker_id: Optional[str] = None,
    session_id: Optional[str] = None,
    circuit_revision: Optional[int] = None,
    context_schema_version: Optional[str] = None,
    fallback_reason: Optional[str] = None,
) -> Dict[str, Any]:
    """Build the canonical 8-field response provenance metadata object."""
    return {
        "response_source": response_source,
        "job_id": job_id,
        "worker_id": worker_id or None,
        "session_id": session_id or None,
        "circuit_revision": circuit_revision if type(circuit_revision) is int else None,
        "context_schema_version": context_schema_version or None,
        "response_status": response_status,
        "fallback_reason": fallback_reason or None,
    }


def _job_provenance(
    job: XenJob,
    *,
    response_source: str,
    response_status: str,
    worker_id: Optional[str] = None,
    fallback_reason: Optional[str] = None,
) -> Dict[str, Any]:
    """Assemble provenance metadata for a XenJob from DB fields, payload, and CyberLab session store."""
    payload = job.response_payload if isinstance(job.response_payload, dict) else {}
    ctx_meta = payload.get("context_meta") if isinstance(payload.get("context_meta"), dict) else {}

    raw_sid = getattr(job, "context_session_id", None)
    sid = raw_sid.strip() if isinstance(raw_sid, str) and raw_sid.strip() else None
    if not sid and isinstance(ctx_meta.get("session_id"), str) and ctx_meta["session_id"].strip():
        sid = ctx_meta["session_id"].strip()

    raw_rev = getattr(job, "context_revision", None)
    rev = raw_rev if type(raw_rev) is int else (ctx_meta.get("circuit_revision") if type(ctx_meta.get("circuit_revision")) is int else None)

    raw_sv = ctx_meta.get("context_schema_version")
    schema_ver = raw_sv.strip()[:32] if isinstance(raw_sv, str) and raw_sv.strip() else None
    if not schema_ver and sid and isinstance(job, XenJob) and getattr(job, "user_id", None):
        stored_ctx = (
            XenCyberLabContext.objects
            .filter(user_id=job.user_id, session_id=sid)
            .values_list("context_payload", flat=True)
            .first()
        )
        if isinstance(stored_ctx, dict) and isinstance(stored_ctx.get("schema_version"), str):
            schema_ver = stored_ctx["schema_version"].strip()[:32] or None

    resolved_worker = None
    for cand in (worker_id, payload.get("worker_id"), getattr(job, "worker_id", None)):
        if isinstance(cand, str) and cand.strip():
            resolved_worker = cand.strip()
            break

    status_str = response_status if isinstance(response_status, str) else XenJobStatus.QUEUED
    gv = payload.get("grounding_verification")
    eff_source = response_source
    eff_status = status_str
    eff_reason = fallback_reason if isinstance(fallback_reason, str) else None
    if (
        isinstance(gv, dict)
        and gv.get("fallback_applied") is True
        and eff_source != "cache"
        and eff_status == "completed"
    ):
        eff_source = "local_fallback"
        eff_status = "grounding_fallback"
        eff_reason = "GROUNDING_VERIFICATION_FAILED"

    return _build_response_provenance(
        response_source=eff_source,
        response_status=eff_status,
        job_id=str(job.id),
        worker_id=resolved_worker,
        session_id=sid,
        circuit_revision=rev,
        context_schema_version=schema_ver,
        fallback_reason=eff_reason,
    )


class XenBaseView(APIView):
    """Base class for Xen views providing permission verification and upstream proxy utilities."""
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def cohort_denial(self, user, request_id=None):
        # 1. Feature Flag: XEN_PILOT_ENABLED Gating
        if not getattr(settings, "XEN_PILOT_ENABLED", False):
            return Response(
                {
                    "error": "PixiuMind Xen pilot is currently disabled. Access is restricted to authorized deployment windows.",
                    "code": "XEN_PILOT_DISABLED",
                    "request_id": request_id,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        role = getattr(user, "role", "")

        # 2. Closed Production Pilot Role Gate.
        # Students are eligible only when their account ID is in the server-side
        # tester allowlist below. School accounts remain categorically excluded.
        if role == UserRole.SCHOOL:
            return Response(
                {
                    "error": "School user access is disabled during Closed Production cohort validation.",
                    "code": "SCHOOL_ACCESS_DISABLED",
                    "request_id": request_id,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if role not in {UserRole.ADMIN, UserRole.TRAINER, UserRole.STUDENT}:
            return Response(
                {
                    "error": "Access is restricted to allowlisted Admin, Trainer, and Student pilot accounts.",
                    "code": "ROLE_ACCESS_DISABLED",
                    "request_id": request_id,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # 3. Server-side tester allowlist enforcement (Missing, empty, or malformed denies all access)
        tester_allowlist = getattr(settings, "PIXIUMIND_TESTER_ALLOWLIST", None)
        if (
            tester_allowlist is None
            or not isinstance(tester_allowlist, (list, tuple, set))
            or len(tester_allowlist) == 0
            or not all(isinstance(x, str) and x.isascii() and x.isdecimal() for x in tester_allowlist)
        ):
            return Response(
                {
                    "error": "Tester allowlist is missing or unconfigured. Access is strictly denied.",
                    "code": "ALLOWLIST_NOT_CONFIGURED",
                    "request_id": request_id,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if str(user.pk) not in tester_allowlist:
            return Response(
                {
                    "error": "User is not authorized for the Closed Production testing cohort.",
                    "code": "NOT_IN_TESTER_ALLOWLIST",
                    "request_id": request_id,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return None

    def call_upstream(
        self,
        endpoint_path: str,
        method: str = "GET",
        payload: Optional[Dict[str, Any]] = None,
        timeout: Optional[int] = None,
    ) -> Tuple[int, Dict[str, Any]]:
        base_url = getattr(settings, "PIXIUMIND_ENDPOINT_URL", "").strip().rstrip("/")
        api_key = getattr(settings, "PIXIUMIND_API_KEY", "").strip()
        timeout = timeout or getattr(settings, "PIXIUMIND_TIMEOUT_SECONDS", 450)

        if not base_url:
            return status.HTTP_503_SERVICE_UNAVAILABLE, {
                "error": "PixiuMind inference service is not configured.",
                "code": "PROVIDER_UNCONFIGURED",
            }

        target_url = f"{base_url}{endpoint_path}"
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        data_bytes = json.dumps(payload).encode("utf-8") if payload is not None else None
        req = urllib.request.Request(target_url, data=data_bytes, headers=headers, method=method)

        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                resp_code = resp.getcode()
                raw_body = resp.read().decode("utf-8")
                decoded = json.loads(raw_body)
                if not isinstance(decoded, dict):
                    raise ValueError("Expected upstream response object")
                return resp_code, decoded
        except urllib.error.HTTPError as exc:
            with exc:
                logger.warning("Xen upstream HTTP failure route=%s status=%s", endpoint_path, exc.code)
            public_failures = {
                400: ("UPSTREAM_INVALID_REQUEST", "Inference could not accept the request."),
                429: ("UPSTREAM_BUSY", "Inference is temporarily busy."),
                503: ("UPSTREAM_UNAVAILABLE", "Inference is temporarily unavailable."),
                504: ("INFERENCE_TIMEOUT", "Inference request timed out."),
            }
            public_code, message = public_failures.get(exc.code, ("UPSTREAM_ERROR", "Inference request failed."))
            return exc.code if exc.code in public_failures else 502, {"error": message, "code": public_code}
        except TimeoutError:
            logger.warning("Xen upstream timeout route=%s timeout=%s", endpoint_path, timeout)
            return 504, {"error": "Inference request timed out.", "code": "INFERENCE_TIMEOUT"}
        except urllib.error.URLError as exc:
            logger.warning("Xen upstream connection failure route=%s type=%s", endpoint_path, type(exc.reason).__name__)
            if isinstance(exc.reason, TimeoutError):
                return 504, {"error": "Inference request timed out.", "code": "INFERENCE_TIMEOUT"}
            return 502, {"error": "Inference service could not be reached.", "code": "UPSTREAM_UNREACHABLE"}
        except (ValueError, OSError) as exc:
            logger.warning("Xen upstream response failure route=%s type=%s", endpoint_path, type(exc).__name__)
            return 502, {"error": "Inference returned an invalid response.", "code": "UPSTREAM_ERROR"}


class XenHealthView(XenBaseView):
    """
    Check the health and readiness of the upstream inference engine.
    """
    def get(self, request, *args, **kwargs):
        if denial := self.cohort_denial(request.user):
            return denial
        code, live_data = self.call_upstream("/health/live", method="GET", timeout=5)
        if code != 200:
            return Response(
                {"status": "degraded", "upstream_live": False, "details": live_data},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        code_ready, ready_data = self.call_upstream("/health/ready", method="GET", timeout=5)
        is_ready = (code_ready == 200)

        return Response(
            {
                "status": "healthy" if is_ready else "initializing",
                "upstream_live": True,
                "upstream_ready": is_ready,
                "ready_details": ready_data,
            },
            status=status.HTTP_200_OK if is_ready else status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class XenAttestationView(XenBaseView):
    """
    Returns cryptographic attestation and model provenance from the inference engine.
    Restricted to Admins and Trainers even when Students are allowlisted for tutoring.
    """
    def get(self, request, *args, **kwargs):
        if getattr(request.user, "role", "") not in {UserRole.ADMIN, UserRole.TRAINER}:
            return Response(
                {"error": "Model attestation is restricted to Admins and Trainers.", "code": "PERMISSION_DENIED"},
                status=status.HTTP_403_FORBIDDEN,
            )

        if denial := self.cohort_denial(request.user):
            return denial

        code, data = self.call_upstream("/v1/attestation", method="GET", timeout=10)
        if code == 200:
            attestation = data.get("attestation")
            if not isinstance(attestation, dict):
                return Response(
                    {"error": "Inference returned an invalid attestation.", "code": "UPSTREAM_ERROR"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            data = {
                "status": "verified",
                "is_ready": data.get("is_ready") is True,
                "attestation": {
                    key: attestation[key]
                    for key in (
                        "base_model", "base_revision", "base_shards_verified", "base_metadata_verified",
                        "adapter", "adapter_sha256", "adapter_config_status", "a1_prompt_sha256", "runtime_versions",
                    )
                    if key in attestation
                },
            }
        return Response(data, status=code)


_CYBERLAB_SESSION_RE = re.compile(r"^[a-zA-Z0-9._:-]{1,128}$")
_CYBERLAB_ALLOWED_EVENTS = frozenset({
    "wire_start",
    "target_hover_enter",
    "target_hover_leave",
    "target_validation",
    "wire_complete",
    "wire_cancel",
    "wire_delete",
    "connection_replace",
    "session_reset",
    "circuit_snapshot",
})


def _extract_rev_tuple(env: Optional[Dict[str, Any]]) -> Tuple[int, int, int]:
    if not isinstance(env, dict):
        return (0, 0, 0)
    circuit = env.get("circuit") if isinstance(env.get("circuit"), dict) else {}
    def _nonneg_int(val: Any) -> int:
        return val if type(val) is int and val >= 0 else 0
    c_rev = _nonneg_int(env.get("circuit_revision") if env.get("circuit_revision") is not None else circuit.get("circuit_revision"))
    i_rev = _nonneg_int(env.get("interaction_revision") if env.get("interaction_revision") is not None else circuit.get("interaction_revision"))
    if c_rev == 0 and i_rev == 0:
        sr = env.get("state_revision") if env.get("state_revision") is not None else circuit.get("state_revision")
        c_rev = _nonneg_int(sr)
    e_seq = _nonneg_int(env.get("event_seq"))
    return (c_rev, i_rev, e_seq)


def resolve_authoritative_context_envelope(
    user: Any,
    raw_envelope: Any,
) -> Tuple[Dict[str, Any], str, Optional[int]]:
    """
    Sanitize incoming context_envelope and reconcile against the authenticated
    user's persisted XenCyberLabContext session snapshot if present.
    - Enforces user ownership (cross-user sessions are never readable).
    - Keeps incoming chat-submit snapshot authoritative when >= stored revision.
    - Prevents older context from silently overwriting newer session state.
    """
    incoming = sanitize_context_envelope(raw_envelope)
    session_id = incoming.get("session_id") or ""
    if not session_id or not _CYBERLAB_SESSION_RE.match(session_id) or not isinstance(user, User) or not user.pk:
        c_rev = incoming.get("circuit_revision", incoming.get("state_revision"))
        return incoming, session_id, c_rev if type(c_rev) is int else None

    incoming_rev = _extract_rev_tuple(incoming)
    now = timezone.now()
    stored = (
        XenCyberLabContext.objects
        .filter(user=user, session_id=session_id, expires_at__gt=now)
        .first()
    )
    if stored is not None and stored.revision_tuple() > incoming_rev:
        # Server already persisted a strictly newer revision for this user's session.
        effective = sanitize_context_envelope(stored.context_payload) if isinstance(stored.context_payload, dict) else dict(incoming)
        effective["session_id"] = session_id
        effective["reconciled_from_server_revision"] = list(stored.revision_tuple())
        return effective, session_id, stored.circuit_revision

    # Authoritative incoming snapshot: refresh persisted server snapshot atomically if newer/equal
    if isinstance(incoming.get("circuit"), dict):
        try:
            with transaction.atomic():
                existing = (
                    XenCyberLabContext.objects
                    .select_for_update()
                    .filter(user=user, session_id=session_id)
                    .first()
                )
                if existing is None:
                    XenCyberLabContext.objects.create(
                        user=user,
                        session_id=session_id,
                        circuit_revision=incoming_rev[0],
                        interaction_revision=incoming_rev[1],
                        event_seq=incoming_rev[2],
                        last_event_id=str(incoming.get("event_id") or "")[:128],
                        last_event_type="chat_snapshot",
                        context_payload=incoming,
                        expires_at=XenCyberLabContext.default_expiry(),
                    )
                elif incoming_rev >= existing.revision_tuple():
                    existing.circuit_revision = incoming_rev[0]
                    existing.interaction_revision = incoming_rev[1]
                    existing.event_seq = incoming_rev[2]
                    if incoming.get("event_id"):
                        existing.last_event_id = str(incoming["event_id"])[:128]
                    existing.last_event_type = "chat_snapshot"
                    existing.context_payload = incoming
                    existing.expires_at = XenCyberLabContext.default_expiry()
                    existing.save(update_fields=[
                        "circuit_revision", "interaction_revision", "event_seq",
                        "last_event_id", "last_event_type", "context_payload",
                        "expires_at", "updated_at",
                    ])
        except DatabaseError:
            logger.warning("Failed non-fatal context snapshot persist for user=%s session=%s", user.pk, session_id)

    return incoming, session_id, incoming_rev[0]


def _clear_draft_in_sanitized(payload: Dict[str, Any]) -> Dict[str, Any]:
    if isinstance(payload, dict) and isinstance(payload.get("circuit"), dict):
        payload["circuit"].pop("in_progress_connection", None)
    return payload


class XenChatView(XenBaseView):
    """
    Primary chat and tutoring endpoint mediating user interactions with PixiuMind Step-700.
    
    Cohort & Policy Enforcement (P0.1, P1.1, P1.2, P1.3, P1.4):
    - Feature Flag: XEN_PILOT_ENABLED gating.
    - Cohort Role Gate: allowlisted Students, Trainers and Admins; School users denied.
    - Attestation is additionally restricted to Admins and Trainers.
    - Allowlist Gate: Missing, empty, or malformed allowlist denies all access.
    - User Gate: Only explicitly allowlisted Admin/Trainer accounts admitted.
    - Shared Rate Limiter: Atomic Redis-backed cross-process 60 req/min budget; fails closed.
    - Aggregate Context Gate: Total messages <= 20, per-message <= 4000, aggregate <= 16000.
    - Atomic Idempotency: Reserved before model invocation; in-flight returns 409 Conflict.
    - Response Persistence: Unverified or failed outputs never marked complete.
    - Privacy & Sanitization: Delimiters stripped, non-PII operational tracing.
    """
    throttle_classes = []

    @staticmethod
    def persistence_error(request_id):
        return Response(
            {"error": "Xen request storage is temporarily unavailable.", "code": "IDEMPOTENCY_UNAVAILABLE", "request_id": request_id},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    def post(self, request, *args, **kwargs):
        # 0. Operational Request Tracing ID
        request_id = f"xen-{uuid.uuid4().hex[:12]}"

        user = request.user
        if denial := self.cohort_denial(user, request_id):
            return denial
        role = user.role

        if not isinstance(request.data, Mapping):
            return Response(
                {"error": "A JSON object is required.", "code": "INVALID_REQUEST", "request_id": request_id},
                status=status.HTTP_400_BAD_REQUEST,
            )
        idempotency_key = request.data.get("idempotency_key")
        if (
            not isinstance(idempotency_key, str)
            or not idempotency_key.strip()
            or len(idempotency_key) > 128
            or "\x00" in idempotency_key
        ):
            return Response(
                {"error": "A non-empty idempotency key of at most 128 characters is required.",
                 "code": "INVALID_IDEMPOTENCY_KEY", "request_id": request_id},
                status=status.HTTP_400_BAD_REQUEST,
            )
        idempotency_key = idempotency_key.strip()

        if request.data.get("stream") is True:
            return Response(
                {"error": "Streaming is unavailable in Xen v0.1.", "code": "STREAMING_UNSUPPORTED",
                 "request_id": request_id},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Route to asynchronous persistent job queue if requested
        if request.data.get("job_mode") or request.headers.get("X-Job-Mode") == "true":
            return XenJobCreateView.as_view()(request._request)

        # 4. Atomic Shared Redis-Backed Rate Limiter (Cross-process 60 req/min budget; fails closed)
        is_allowed, count, rl_error = check_xen_rate_limit(str(user.id), limit=60, window_seconds=60)
        if not is_allowed:
            if rl_error == "RATE_LIMIT_EXCEEDED":
                return Response(
                    {
                        "error": "Rate limit exceeded. Maximum 60 requests per minute allowed.",
                        "code": "RATE_LIMIT_EXCEEDED",
                        "request_id": request_id,
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
            else:
                return Response(
                    {
                        "error": "Shared rate limiter is unavailable. Access is temporarily restricted.",
                        "code": "RATE_LIMITER_UNAVAILABLE",
                        "request_id": request_id,
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

        # 5. Flexible Schema Extraction (OpenAI messages format vs Portal prompt format)
        raw_prompt = request.data.get("prompt")
        messages_input = request.data.get("messages")
        intent = request.data.get("intent", "TEACHING")
        if isinstance(intent, str):
            intent = intent.strip().upper()
        else:
            intent = "TEACHING"

        history = request.data.get("history", [])
        is_openai_schema = bool(messages_input is not None and raw_prompt is None)

        if raw_prompt is not None and isinstance(raw_prompt, str):
            prompt = raw_prompt.strip()
        elif isinstance(messages_input, list):
            last_turn = messages_input[-1] if messages_input else None
            if isinstance(last_turn, dict) and last_turn.get("role") == "user":
                content = last_turn.get("content")
                prompt = content.strip() if isinstance(content, str) else ""
                history = messages_input[:-1]
            else:
                prompt = ""
        else:
            prompt = ""

        # 6. Aggregate Context and Prompt Limit Enforcement (P1.2)
        if not prompt:
            return Response(
                {"error": "A non-empty prompt is required.", "code": "INVALID_PROMPT", "request_id": request_id},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_chars = getattr(settings, "XEN_MAX_PROMPT_CHARS", 4000)
        if len(prompt) > max_chars:
            return Response(
                {
                    "error": f"Prompt length exceeds maximum allowed limit of {max_chars} characters.",
                    "code": "PROMPT_TOO_LARGE",
                    "request_id": request_id,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(history, list):
            return Response(
                {"error": "History must be a list.", "code": "INVALID_HISTORY", "request_id": request_id},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(history) > 18:
            return Response(
                {"error": "Conversation history exceeds 18 messages.", "code": "TOO_MANY_MESSAGES", "request_id": request_id},
                status=status.HTTP_400_BAD_REQUEST,
            )

        aggregate_chars = len(COMPOSITE_SYSTEM_PROMPT) + len(prompt)
        for idx, turn in enumerate(history):
            if not isinstance(turn, dict) or turn.get("role") not in ("user", "assistant"):
                return Response(
                    {"error": f"Invalid turn in history at index {idx}.", "code": "INVALID_ROLE", "request_id": request_id},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            content = turn.get("content")
            if not isinstance(content, str):
                return Response(
                    {"error": f"Invalid content in history at index {idx}.", "code": "INVALID_HISTORY", "request_id": request_id},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if len(content) > 4000:
                return Response(
                    {"error": f"History message {idx} exceeds limit of 4000 characters.", "code": "MESSAGE_TOO_LARGE", "request_id": request_id},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            aggregate_chars += len(content)

        if aggregate_chars > 16000:
            return Response(
                {"error": f"Aggregate conversation size ({aggregate_chars} chars) exceeds maximum allowed limit of 16000 characters.", "code": "AGGREGATE_PROMPT_TOO_LARGE", "request_id": request_id},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prompt = sanitize_xen_message(prompt)
        if not prompt:
            return Response(
                {"error": "A non-empty prompt is required.", "code": "INVALID_PROMPT", "request_id": request_id},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 7. Intent authorization check with evidence-backed A05 gate
        if role == UserRole.TRAINER:
            trainer_profile = getattr(user, "trainer_profile", None)
            xen_trainer = getattr(trainer_profile, "xen_identity", None) if trainer_profile else None

            if intent == "PERSONAL_LEARNING":
                if not xen_trainer or not xen_trainer.can_access_intent("PERSONAL_LEARNING"):
                    return Response(
                        {
                            "error": "PERSONAL_LEARNING intent requires verified, evidence-backed A05 qualification.",
                            "code": "FORBIDDEN_INTENT",
                            "request_id": request_id,
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )
            if intent not in {"TEACHING", "LAB_TEACHING", "PERSONAL_LEARNING"}:
                intent = "TEACHING"

        elif role == UserRole.ADMIN:
            if intent not in {"ADMIN_INSPECTION", "TEACHING_REVIEW"}:
                intent = "TEACHING_REVIEW"

        # 8. Resolve authoritative circuit context, response format mode, and compacted safe history
        context_envelope_raw = request.data.get("context_envelope")
        context_envelope, ctx_session_id, ctx_rev = resolve_authoritative_context_envelope(user, context_envelope_raw)
        ctx_meta = _extract_context_provenance_meta(context_envelope, ctx_session_id, ctx_rev)
        is_circuit_query = is_circuit_specific_query(prompt, history, context_envelope=context_envelope)
        grounding_spec = (
            build_authoritative_grounding_spec(context_envelope)
            if (is_circuit_query and _extract_circuit_view(context_envelope) is not None)
            else None
        )

        format_pref = request.data.get("format_preference")
        format_mode, mode_source = resolve_xen_response_mode(
            prompt, history=history, active_sticky_preference=format_pref
        )

        compacted_history = compact_xen_history(
            history,
            format_mode,
            current_circuit_revision=ctx_rev,
            current_spec=grounding_spec,
        )
        mode_directive = get_additive_mode_instruction(format_mode)

        max_prompt_chars = getattr(settings, "XEN_MAX_PROMPT_CHARS", 4000)
        effective_prompt = build_xen_effective_prompt(
            prompt=prompt,
            format_mode=format_mode,
            mode_directive=mode_directive,
            context_envelope=context_envelope,
            history=history,
            max_chars=max_prompt_chars,
        )

        # 9. Build upstream message payload (Teacher Memory is explicitly disabled in v0.1)
        messages = [
            {"role": "system", "content": COMPOSITE_SYSTEM_PROMPT},
            *({"role": turn["role"], "content": turn["content"]} for turn in compacted_history),
            {"role": "user", "content": effective_prompt},
        ]

        model_id = getattr(settings, "PIXIUMIND_MODEL_ID", "pixiumind-step-700")
        max_tokens = request.data.get("max_tokens", 1024)
        temperature = request.data.get("temperature", 0.0)
        top_p = request.data.get("top_p", 0.9)
        if (
            type(max_tokens) is not int or not 1 <= max_tokens <= 2048
            or type(temperature) not in (int, float) or not 0 <= temperature <= 2
            or type(top_p) not in (int, float) or not 0 <= top_p <= 1
        ):
            return Response(
                {"error": "Invalid generation parameters.", "code": "INVALID_GENERATION_PARAMETERS", "request_id": request_id},
                status=status.HTTP_400_BAD_REQUEST,
            )

        upstream_payload = {
            "model": model_id,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "top_p": top_p,
        }

        cached = False
        request_hash = hashlib.sha256(
            json.dumps(
                {"body": request.data, "payload": upstream_payload, "intent": intent, "format_mode": format_mode.value, "role": role},
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()
        try:
            session_obj, created = XenSession.objects.get_or_create(
                idempotency_key=idempotency_key,
                user=user,
                defaults={
                    "role": role,
                    "intent": intent,
                    "request_hash": request_hash,
                    "response_summary": "IN_PROGRESS",
                },
            )
        except DatabaseError:
            logger.exception("Could not reserve Xen session %s", request_id)
            return self.persistence_error(request_id)

        if not created:
            if session_obj.request_hash != request_hash:
                return Response(
                    {"error": "Idempotency key conflicts with an existing request.", "code": "IDEMPOTENCY_KEY_REUSED", "request_id": request_id},
                    status=status.HTTP_409_CONFLICT,
                )
            if not session_obj.is_completed or session_obj.response_payload is None:
                return Response(
                    {"error": "A request with this idempotency key is already in progress.", "code": "IDEMPOTENCY_IN_PROGRESS", "request_id": request_id},
                    status=status.HTTP_409_CONFLICT,
                )
            decoded = session_obj.response_payload["decoded"]
            finish_reason = session_obj.response_payload["finish_reason"]
            usage = session_obj.response_payload["usage"]
            cached_ctx_meta = (
                session_obj.response_payload.get("context_meta")
                if isinstance(session_obj.response_payload.get("context_meta"), dict)
                else ctx_meta
            )
            cached_worker_id = session_obj.response_payload.get("worker_id")
            cached_grounding = session_obj.response_payload.get("grounding_verification")
            cached = True

        worker_id_used: Optional[str] = cached_worker_id if cached else None
        grounding_verification: Optional[Dict[str, Any]] = cached_grounding if cached else None
        if not cached:
            persisted = False
            try:
                start_time = time.monotonic()
                code, upstream_resp = self.call_upstream(
                    "/v1/chat/completions", method="POST", payload=upstream_payload,
                )
                if code != 200:
                    err_prov = _build_response_provenance(
                        response_source="error",
                        response_status="error",
                        session_id=ctx_meta["session_id"],
                        circuit_revision=ctx_meta["circuit_revision"],
                        context_schema_version=ctx_meta["context_schema_version"],
                        fallback_reason=upstream_resp.get("code") or f"HTTP_{code}",
                    )
                    return Response({**upstream_resp, "request_id": request_id, "provenance": err_prov}, status=code)

                try:
                    first_choice = upstream_resp["choices"][0]
                    raw_text = first_choice["message"]["content"]
                    finish_reason = first_choice.get("finish_reason", "stop")
                    usage = upstream_resp.get("usage", {})
                    worker_id_used = upstream_resp.get("worker_id") if isinstance(upstream_resp.get("worker_id"), str) else None
                    if (
                        not isinstance(raw_text, str)
                        or not raw_text.strip()
                        or finish_reason not in ("stop", "end_turn", "eos_token", "length")
                        or not isinstance(usage, dict)
                    ):
                        raise TypeError("Invalid completion response fields")
                except (AttributeError, IndexError, KeyError, TypeError):
                    logger.warning("Invalid upstream completion response for %s", request_id)
                    err_prov = _build_response_provenance(
                        response_source="error",
                        response_status="error",
                        session_id=ctx_meta["session_id"],
                        circuit_revision=ctx_meta["circuit_revision"],
                        context_schema_version=ctx_meta["context_schema_version"],
                        fallback_reason="INVALID_UPSTREAM_RESPONSE",
                    )
                    return Response(
                        {"error": "Invalid response from the model.", "code": "INVALID_UPSTREAM_RESPONSE", "request_id": request_id, "provenance": err_prov},
                        status=status.HTTP_502_BAD_GATEWAY,
                    )

                logger.info(
                    "Xen inference returned: request_id=%s user_id=%s role=%s latency_ms=%d",
                    request_id, user.id, role, (time.monotonic() - start_time) * 1000,
                )
                decoded = decode_model_response(
                    raw_text=raw_text,
                    finish_reason=finish_reason,
                    actually_executed=False,
                    intent=intent,
                    format_mode=format_mode.value,
                )
                if not isinstance(decoded.get("text"), str) or not decoded["text"].strip():
                    err_prov = _build_response_provenance(
                        response_source="error",
                        response_status="error",
                        worker_id=worker_id_used,
                        session_id=ctx_meta["session_id"],
                        circuit_revision=ctx_meta["circuit_revision"],
                        context_schema_version=ctx_meta["context_schema_version"],
                        fallback_reason="INVALID_UPSTREAM_RESPONSE",
                    )
                    return Response(
                        {"error": "Empty decoded response from the model.", "code": "INVALID_UPSTREAM_RESPONSE", "request_id": request_id, "provenance": err_prov},
                        status=status.HTTP_502_BAD_GATEWAY,
                    )

                # Specification Part 9.2: One-time retry if response violates CODE_ONLY format
                if format_mode == XenResponseMode.CODE_ONLY and not decoded.get("format_valid", True):
                    logger.info("Chat request %s failed CODE_ONLY validation; executing one-time retry", request_id)
                    strict_retry_directive = (
                        "MANDATORY STRICT RETRY DIRECTIVE:\n"
                        "Your previous response violated the CODE_ONLY format requirement.\n"
                        "You must return EXCLUSIVELY the single ```python ... ``` code block.\n"
                        "Do NOT include any greetings, prose, comments, or explanations.\n"
                        "Output ONLY the code fence."
                    )
                    retry_prompt = f"[{strict_retry_directive}]\n\n{prompt}"
                    retry_messages = [
                        {"role": "system", "content": COMPOSITE_SYSTEM_PROMPT},
                        *({"role": turn["role"], "content": turn["content"]} for turn in compacted_history),
                        {"role": "user", "content": retry_prompt},
                    ]
                    retry_payload = {**upstream_payload, "messages": retry_messages}
                    retry_code, retry_resp = self.call_upstream(
                        "/v1/chat/completions", method="POST", payload=retry_payload,
                    )
                    if retry_code == 200:
                        try:
                            retry_choice = retry_resp["choices"][0]
                            retry_raw_text = retry_choice["message"]["content"]
                            retry_finish = retry_choice.get("finish_reason", "stop")
                            retry_usage = retry_resp.get("usage", usage)
                            retry_decoded = decode_model_response(
                                raw_text=retry_raw_text,
                                finish_reason=retry_finish,
                                actually_executed=False,
                                intent=intent,
                                format_mode=format_mode.value,
                            )
                            decoded = retry_decoded
                            finish_reason = retry_finish
                            usage = retry_usage
                        except Exception as e:
                            logger.warning("Retry parsing failed for %s: %s", request_id, e)

                # Phase 2 Post-Generation Grounding Verifier (sync single constrained retry + deterministic fallback)
                if grounding_spec and grounding_spec.get("has_circuit"):
                    g_check = extract_and_validate_grounding_claims(decoded["text"], grounding_spec, prompt)
                    unsupported_all = list(g_check["unsupported_claims"])
                    claim_ledger = list(g_check["claim_ledger"])
                    initial_verified = bool(g_check["verified"])
                    retry_attempted = False
                    fallback_applied = False

                    if not initial_verified:
                        logger.warning(
                            "Sync chat %s failed circuit grounding (%s); executing single constrained retry",
                            request_id, unsupported_all[:3],
                        )
                        retry_attempted = True
                        regen_prompt = build_constrained_regeneration_prompt(
                            effective_prompt,
                            unsupported_all,
                            grounding_spec,
                            format_mode_value=format_mode.value,
                            max_chars=max_prompt_chars,
                        )
                        regen_messages = [
                            {"role": "system", "content": COMPOSITE_SYSTEM_PROMPT},
                            *({"role": turn["role"], "content": turn["content"]} for turn in compacted_history),
                            {"role": "user", "content": regen_prompt},
                        ]
                        regen_code, regen_resp = self.call_upstream(
                            "/v1/chat/completions", method="POST", payload={**upstream_payload, "messages": regen_messages},
                        )
                        retry_decoded = None
                        retry_check = None
                        if regen_code == 200:
                            try:
                                r_choice = regen_resp["choices"][0]
                                r_raw = r_choice["message"]["content"]
                                r_finish = r_choice.get("finish_reason", "stop")
                                r_usage = regen_resp.get("usage", usage)
                                retry_decoded = decode_model_response(
                                    raw_text=r_raw,
                                    finish_reason=r_finish,
                                    actually_executed=False,
                                    intent=intent,
                                    format_mode=format_mode.value,
                                )
                                retry_check = extract_and_validate_grounding_claims(retry_decoded["text"], grounding_spec, prompt)
                                usage = r_usage
                                finish_reason = r_finish
                            except Exception as exc:
                                logger.warning("Grounding retry parsing failed for %s: %s", request_id, exc)

                        if retry_decoded and retry_check and retry_check["verified"]:
                            decoded = retry_decoded
                            claim_ledger.extend(retry_check["claim_ledger"])
                        else:
                            if retry_check:
                                for uc in retry_check["unsupported_claims"]:
                                    if uc not in unsupported_all:
                                        unsupported_all.append(uc)
                                claim_ledger.extend(retry_check["claim_ledger"])
                            fallback_applied = True
                            fallback_text = build_deterministic_grounded_fallback(
                                grounding_spec,
                                prompt,
                                retry_decoded["text"] if retry_decoded else decoded["text"],
                                unsupported_all,
                                (retry_check or g_check)["unsupported_clauses"],
                            )
                            decoded = {
                                **decoded,
                                "text": fallback_text,
                                "is_complete": True,
                                "completion_status": "GROUNDING_FALLBACK",
                            }

                    grounding_verification = {
                        "verified": True,
                        "model_verified": not fallback_applied,
                        "initial_verified": initial_verified,
                        "retry_attempted": retry_attempted,
                        "fallback_applied": fallback_applied,
                        "final_output_source": (
                            "deterministic_grounded_fallback"
                            if fallback_applied
                            else ("xen_retry" if retry_attempted else "xen_step700")
                        ),
                        "circuit_revision": ctx_rev,
                        "unsupported_claims": unsupported_all,
                        "claim_ledger": claim_ledger[:24],
                    }

                if session_obj is not None and decoded["is_complete"]:
                    session_obj.is_completed = True
                    session_obj.response_summary = decoded["text"]
                    session_obj.response_payload = {
                        "decoded": {
                            key: decoded[key] for key in (
                                "text", "is_complete", "completion_status", "syntax_valid",
                                "display_ast_valid", "tested", "code_leakage_in_explanation",
                                "format_mode", "format_valid",
                            )
                            if key in decoded
                        },
                        "finish_reason": finish_reason,
                        "usage": usage,
                        "worker_id": worker_id_used,
                        "context_meta": ctx_meta,
                        **({"grounding_verification": grounding_verification} if grounding_verification is not None else {}),
                    }
                    try:
                        session_obj.save(update_fields=["is_completed", "response_summary", "response_payload"])
                    except DatabaseError:
                        logger.exception("Could not persist Xen response %s", request_id)
                        return self.persistence_error(request_id)
                    persisted = True
            finally:
                if session_obj is not None and not persisted:
                    try:
                        session_obj.delete()
                    except DatabaseError:
                        logger.exception("Could not release Xen reservation %s", request_id)

        eff_meta = cached_ctx_meta if cached else ctx_meta
        sync_fallback_applied = bool(
            isinstance(grounding_verification, dict) and grounding_verification.get("fallback_applied")
        )
        provenance = _build_response_provenance(
            response_source="cache" if cached else ("local_fallback" if sync_fallback_applied else "xen_step700"),
            response_status="cached" if cached else ("grounding_fallback" if sync_fallback_applied else "completed"),
            worker_id=worker_id_used,
            session_id=eff_meta.get("session_id"),
            circuit_revision=eff_meta.get("circuit_revision"),
            context_schema_version=eff_meta.get("context_schema_version"),
            fallback_reason="GROUNDING_VERIFICATION_FAILED" if (sync_fallback_applied and not cached) else None,
        )

        # 14. Format response based on endpoint or request schema
        if is_openai_schema or request.path.endswith("/ai/chat/completions"):
            return Response(
                {
                    "id": f"chatcmpl-{request_id}",
                    "object": "chat.completion",
                    "created": int(time.time()),
                    "model": model_id,
                    "choices": [
                        {
                            "index": 0,
                            "message": {
                                "role": "assistant",
                                "content": decoded["text"],
                            },
                            "finish_reason": finish_reason,
                        }
                    ],
                    "usage": usage,
                    "provenance": provenance,
                    **({"grounding_verification": grounding_verification} if grounding_verification is not None else {}),
                    "xen_metadata": {
                        "request_id": request_id,
                        "status": "ok",
                        "intent": intent,
                        "format_mode": format_mode.value,
                        **({"cached": True} if cached else {}),
                        "provenance": provenance,
                        "is_complete": decoded["is_complete"],
                        "completion_status": decoded["completion_status"],
                        "syntax_valid": decoded["syntax_valid"],
                        "format_valid": decoded.get("format_valid", True),
                        "tested": decoded["tested"],
                    },
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                "status": "ok",
                "request_id": request_id,
                "assistant": "Xen",
                "model": model_id,
                "intent": intent,
                "format_mode": format_mode.value,
                **({"cached": True} if cached else {}),
                "provenance": provenance,
                **({"grounding_verification": grounding_verification} if grounding_verification is not None else {}),
                "teacher_memory_enabled": False,  # Personal Teacher Memory explicitly disabled in v0.1
                "response": {
                    "text": decoded["text"],
                    "is_complete": decoded["is_complete"],
                    "completion_status": decoded["completion_status"],
                    "syntax_valid": decoded["syntax_valid"],
                    "display_ast_valid": decoded["display_ast_valid"],
                    "format_valid": decoded.get("format_valid", True),
                    "tested": decoded["tested"],
                    "code_leakage_detected": decoded["code_leakage_in_explanation"],
                },
                "usage": usage,
                "actor": {
                    "user_id": str(user.id),
                    "role": role,
                },
            },
            status=status.HTTP_200_OK,
        )


class XenJobCreateView(XenBaseView):
    """
    Submits an asynchronous inference job to the persistent Xen job queue.
    Designed for Kaggle GPU outbound workers.
    """
    def post(self, request):
        request_id = str(uuid.uuid4())
        user = request.user
        role = getattr(user, "role", "")

        # 1. Cohort Gating
        denial = self.cohort_denial(user, request_id)
        if denial:
            return denial

        # 2. Rate Limiter (Cross-process 60 req/min budget; fails closed)
        is_allowed, count, rl_error = check_xen_rate_limit(str(user.id), limit=60, window_seconds=60)
        if not is_allowed:
            if rl_error == "RATE_LIMIT_EXCEEDED":
                return Response(
                    {
                        "error": "Rate limit exceeded. Maximum 60 requests per minute allowed.",
                        "code": "RATE_LIMIT_EXCEEDED",
                        "request_id": request_id,
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
            else:
                return Response(
                    {
                        "error": "Shared rate limiter is unavailable. Access is temporarily restricted.",
                        "code": "RATE_LIMITER_UNAVAILABLE",
                        "request_id": request_id,
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

        # 3. Input Extraction & Validation
        raw_prompt = request.data.get("prompt")
        messages_input = request.data.get("messages")
        intent = request.data.get("intent", "TEACHING")
        if isinstance(intent, str):
            intent = intent.strip().upper()
        else:
            intent = "TEACHING"

        history = request.data.get("history", [])

        if raw_prompt is not None and isinstance(raw_prompt, str):
            prompt = raw_prompt.strip()
        elif isinstance(messages_input, list):
            last_turn = messages_input[-1] if messages_input else None
            if isinstance(last_turn, dict) and last_turn.get("role") == "user":
                content = last_turn.get("content")
                prompt = content.strip() if isinstance(content, str) else ""
                history = messages_input[:-1]
            else:
                prompt = ""
        else:
            prompt = ""

        if not prompt:
            return Response(
                {"error": "A non-empty prompt is required.", "code": "INVALID_PROMPT", "request_id": request_id},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_chars = getattr(settings, "XEN_MAX_PROMPT_CHARS", 4000)
        if len(prompt) > max_chars:
            return Response(
                {
                    "error": f"Prompt length exceeds maximum allowed limit of {max_chars} characters.",
                    "code": "PROMPT_TOO_LARGE",
                    "request_id": request_id,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(history, list):
            return Response(
                {"error": "History must be a list.", "code": "INVALID_HISTORY", "request_id": request_id},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(history) > 18:
            return Response(
                {"error": "Conversation history exceeds 18 messages.", "code": "TOO_MANY_MESSAGES", "request_id": request_id},
                status=status.HTTP_400_BAD_REQUEST,
            )

        aggregate_chars = len(COMPOSITE_SYSTEM_PROMPT) + len(prompt)
        for idx, turn in enumerate(history):
            if not isinstance(turn, dict) or turn.get("role") not in ("user", "assistant"):
                return Response(
                    {"error": f"Invalid turn in history at index {idx}.", "code": "INVALID_ROLE", "request_id": request_id},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            content = turn.get("content")
            if not isinstance(content, str):
                return Response(
                    {"error": f"Invalid content in history at index {idx}.", "code": "INVALID_HISTORY", "request_id": request_id},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if len(content) > 4000:
                return Response(
                    {"error": f"History message {idx} exceeds limit of 4000 characters.", "code": "MESSAGE_TOO_LARGE", "request_id": request_id},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            aggregate_chars += len(content)

        if aggregate_chars > 16000:
            return Response(
                {"error": f"Aggregate conversation size ({aggregate_chars} chars) exceeds maximum allowed limit of 16000 characters.", "code": "AGGREGATE_PROMPT_TOO_LARGE", "request_id": request_id},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prompt = sanitize_xen_message(prompt)
        if not prompt:
            return Response(
                {"error": "A non-empty prompt is required.", "code": "INVALID_PROMPT", "request_id": request_id},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 4. Intent authorization check with evidence-backed A05 gate
        if role == UserRole.TRAINER:
            trainer_profile = getattr(user, "trainer_profile", None)
            xen_trainer = getattr(trainer_profile, "xen_identity", None) if trainer_profile else None

            if intent == "PERSONAL_LEARNING":
                if not xen_trainer or not xen_trainer.can_access_intent("PERSONAL_LEARNING"):
                    return Response(
                        {
                            "error": "PERSONAL_LEARNING intent requires verified, evidence-backed A05 qualification.",
                            "code": "FORBIDDEN_INTENT",
                            "request_id": request_id,
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )
            if intent not in {"TEACHING", "LAB_TEACHING", "PERSONAL_LEARNING"}:
                intent = "TEACHING"

        elif role == UserRole.ADMIN:
            if intent not in {"ADMIN_INSPECTION", "TEACHING_REVIEW"}:
                intent = "TEACHING_REVIEW"

        # 5. Resolve context, format mode, and compacted history (Specifications Part 5-8 + Phase 2 Grounding)
        context_envelope_raw = request.data.get("context_envelope")
        context_envelope, ctx_session_id, ctx_rev = resolve_authoritative_context_envelope(user, context_envelope_raw)
        ctx_meta = _extract_context_provenance_meta(context_envelope, ctx_session_id, ctx_rev)
        is_circuit_query = is_circuit_specific_query(prompt, history, context_envelope=context_envelope)
        grounding_spec = (
            build_authoritative_grounding_spec(context_envelope)
            if (is_circuit_query and _extract_circuit_view(context_envelope) is not None)
            else None
        )

        format_pref = request.data.get("format_preference")
        format_mode, mode_source = resolve_xen_response_mode(
            prompt, history=history, active_sticky_preference=format_pref
        )

        compacted_history = compact_xen_history(
            history,
            format_mode,
            current_circuit_revision=ctx_rev,
            current_spec=grounding_spec,
        )
        mode_directive = get_additive_mode_instruction(format_mode)

        # Budget context body dynamically so directives + context + prompt fits V11 4000-char limit.
        max_prompt_chars = getattr(settings, "XEN_MAX_PROMPT_CHARS", 4000)
        effective_prompt = build_xen_effective_prompt(
            prompt=prompt,
            format_mode=format_mode,
            mode_directive=mode_directive,
            context_envelope=context_envelope,
            history=history,
            max_chars=max_prompt_chars,
        )

        if len(effective_prompt) > 4000 or len(effective_prompt) + sum(len(m["content"]) for m in compacted_history) + len(COMPOSITE_SYSTEM_PROMPT) > 16000:
            return Response({"code": "CONTEXT_TOO_LARGE", "error": "Conversation and circuit context exceed the serving limit."}, status=400)

        # 6. Idempotency Key Handling
        idempotency_key = request.data.get("idempotency_key")
        if not isinstance(idempotency_key, str) or not idempotency_key.strip() or len(idempotency_key) > 128 or "\x00" in idempotency_key:
            return Response({"code": "INVALID_IDEMPOTENCY_KEY", "request_id": request_id}, status=400)
        idempotency_key = idempotency_key.strip()
        request_hash = hashlib.sha256(f"{user.id}:{intent}:{effective_prompt}:{json.dumps(compacted_history, sort_keys=True)}".encode("utf-8")).hexdigest()
        try:
            max_tokens = int(request.data.get("max_tokens", 2048))
        except (ValueError, TypeError):
            max_tokens = 2048
        max_tokens = min(max(max_tokens, 1), 2048)

        try:
            temperature = float(request.data.get("temperature", 0.7))
        except (ValueError, TypeError):
            temperature = 0.7
        temperature = max(min(temperature, 2.0), 0.0)

        try:
            initial_payload: Dict[str, Any] = {}
            if (ctx_meta.get("context_schema_version") or ctx_meta.get("session_id") or ctx_meta.get("circuit_revision") is not None):
                initial_payload["context_meta"] = ctx_meta
            if grounding_spec and grounding_spec.get("has_circuit"):
                initial_payload["grounding_envelope"] = context_envelope
            job, created = XenJob.objects.get_or_create(
                user=user, idempotency_key=idempotency_key,
                defaults={"role": role, "intent": intent, "format_mode": format_mode.value, "status": XenJobStatus.QUEUED,
                          "request_hash": request_hash, "prompt": effective_prompt, "history": compacted_history,
                          "max_tokens": max_tokens, "temperature": temperature,
                          "context_session_id": ctx_session_id[:128] if ctx_session_id else "",
                          "context_revision": ctx_rev,
                          "response_payload": initial_payload},
            )
        except DatabaseError:
            logger.exception("Could not persist XenJob %s", request_id)
            return Response(
                {"error": "Failed to enqueue inference job.", "code": "JOB_CREATION_FAILED", "request_id": request_id},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if not created:
            if (job.request_hash != request_hash or job.max_tokens != max_tokens or job.temperature != temperature):
                return Response({"code": "IDEMPOTENCY_CONFLICT", "request_id": request_id}, status=409)
            worker_online = XenWorkerHeartbeat.is_any_worker_online()
            if job.status == XenJobStatus.COMPLETED:
                payload = job.response_payload if isinstance(job.response_payload, dict) else {}
                decoded = payload.get("decoded", {})
                provenance = _job_provenance(
                    job,
                    response_source="cache",
                    response_status="cached",
                )
                return Response(
                    {
                        "status": "completed",
                        "job_id": str(job.id),
                        "worker_id": provenance["worker_id"],
                        "request_id": request_id,
                        "assistant": "Xen",
                        "model": "pixiumind-1.4-d14-step700",
                        "intent": job.effective_intent,
                        "format_mode": job.effective_format_mode,
                        "cached": True,
                        "provenance": provenance,
                        **({"grounding_verification": payload["grounding_verification"]} if isinstance(payload.get("grounding_verification"), dict) else {}),
                        "response": {
                            "text": job.response_summary,
                            "is_complete": decoded.get("is_complete", True),
                            "completion_status": decoded.get("completion_status", "complete"),
                            "syntax_valid": decoded.get("syntax_valid", True),
                            "display_ast_valid": decoded.get("display_ast_valid", False if job.effective_format_mode == "CODE_ONLY" else True),
                            "format_valid": decoded.get("format_valid", True),
                            "tested": decoded.get("tested", False),
                            "code_leakage_detected": decoded.get("code_leakage_in_explanation", False),
                        },
                        "usage": payload.get("usage", {}),
                        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                        "created_at": job.created_at.isoformat(),
                    },
                    status=status.HTTP_200_OK,
                )
            else:
                queue_pos = 0
                if job.status == XenJobStatus.QUEUED:
                    queue_pos = XenJob.objects.filter(status=XenJobStatus.QUEUED, created_at__lte=job.created_at).count()
                pending_prov = _job_provenance(
                    job,
                    response_source="error" if job.status in (XenJobStatus.FAILED, XenJobStatus.EXPIRED, XenJobStatus.CANCELLED) else "xen_step700",
                    response_status=job.status,
                    fallback_reason=job.error_code or (job.status.upper() if job.status in (XenJobStatus.FAILED, XenJobStatus.EXPIRED, XenJobStatus.CANCELLED) else None),
                )
                return Response(
                    {
                        "status": job.status,
                        "job_id": str(job.id),
                        "worker_id": pending_prov["worker_id"],
                        "request_id": request_id,
                        "idempotency_key": idempotency_key,
                        "intent": job.effective_intent,
                        "format_mode": job.effective_format_mode,
                        "worker_available": worker_online,
                        "queue_position": queue_pos,
                        "provenance": pending_prov,
                        "created_at": job.created_at.isoformat(),
                    },
                    status=status.HTTP_202_ACCEPTED,
                )

        worker_online = XenWorkerHeartbeat.is_any_worker_online()
        queue_pos = XenJob.objects.filter(status=XenJobStatus.QUEUED, created_at__lte=job.created_at).count()
        queued_prov = _job_provenance(
            job,
            response_source="xen_step700",
            response_status=XenJobStatus.QUEUED,
        )

        return Response(
            {
                "status": "queued",
                "job_id": str(job.id),
                "worker_id": queued_prov["worker_id"],
                "request_id": request_id,
                "idempotency_key": idempotency_key,
                "intent": job.effective_intent,
                "format_mode": job.effective_format_mode,
                "worker_available": worker_online,
                "queue_position": queue_pos,
                "provenance": queued_prov,
                "created_at": job.created_at.isoformat(),
            },
            status=status.HTTP_202_ACCEPTED,
        )


class XenJobDetailView(XenBaseView):
    """
    Retrieves the status and result of a specific XenJob.
    Enforces strict user ownership: only job creator or admin can view the job.
    """
    def get(self, request, job_id):
        request_id = str(uuid.uuid4())
        user = request.user

        # 1. Cohort Gating
        denial = self.cohort_denial(user, request_id)
        if denial:
            return denial

        try:
            job = XenJob.objects.get(id=job_id)
        except (XenJob.DoesNotExist, ValueError):
            return Response(
                {"error": "Job not found.", "code": "JOB_NOT_FOUND", "request_id": request_id},
                status=status.HTTP_404_NOT_FOUND,
            )

        # 2. Strict Ownership Check (fails with 404 to prevent enumeration)
        if job.user_id != user.id and getattr(user, "role", "") != UserRole.ADMIN:
            return Response(
                {"error": "Job not found.", "code": "JOB_NOT_FOUND", "request_id": request_id},
                status=status.HTTP_404_NOT_FOUND,
            )

        if job.status == XenJobStatus.COMPLETED:
            payload = job.response_payload if isinstance(job.response_payload, dict) else {}
            decoded = payload.get("decoded", {})
            provenance = _job_provenance(
                job,
                response_source="xen_step700",
                response_status="completed",
            )
            return Response(
                {
                    "status": "completed",
                    "job_id": str(job.id),
                    "worker_id": provenance["worker_id"],
                    "request_id": request_id,
                    "assistant": "Xen",
                    "model": "xen-step-700",
                    "intent": job.effective_intent,
                    "format_mode": job.effective_format_mode,
                    "provenance": provenance,
                    **({"grounding_verification": payload["grounding_verification"]} if isinstance(payload.get("grounding_verification"), dict) else {}),
                    "response": {
                        "text": job.response_summary,
                        "is_complete": decoded.get("is_complete", True),
                        "completion_status": decoded.get("completion_status", "complete"),
                        "syntax_valid": decoded.get("syntax_valid", True),
                        "display_ast_valid": decoded.get("display_ast_valid", False if job.effective_format_mode == "CODE_ONLY" else True),
                        "format_valid": decoded.get("format_valid", True),
                        "tested": decoded.get("tested", False),
                        "code_leakage_detected": decoded.get("code_leakage_in_explanation", False),
                    },
                    "usage": payload.get("usage", {}),
                    "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                    "created_at": job.created_at.isoformat(),
                },
                status=status.HTTP_200_OK,
            )

        if job.status == XenJobStatus.FAILED:
            err_code = job.error_code or "INFERENCE_FAILED"
            err_prov = _job_provenance(
                job,
                response_source="error",
                response_status="failed",
                fallback_reason=err_code,
            )
            return Response(
                {
                    "status": "failed",
                    "job_id": str(job.id),
                    "worker_id": err_prov["worker_id"],
                    "request_id": request_id,
                    "provenance": err_prov,
                    "error": {
                        "code": err_code,
                        "message": "Inference failed on the GPU worker.",
                    },
                    "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                    "created_at": job.created_at.isoformat(),
                },
                status=status.HTTP_200_OK,
            )

        queue_pos = 0
        if job.status == XenJobStatus.QUEUED:
            queue_pos = XenJob.objects.filter(status=XenJobStatus.QUEUED, created_at__lte=job.created_at).count()
        pending_prov = _job_provenance(
            job,
            response_source="error" if job.status in (XenJobStatus.EXPIRED, XenJobStatus.CANCELLED) else "xen_step700",
            response_status=job.status,
            fallback_reason=job.error_code or (job.status.upper() if job.status in (XenJobStatus.EXPIRED, XenJobStatus.CANCELLED) else None),
        )

        return Response(
            {
                "status": job.status,
                "job_id": str(job.id),
                "worker_id": pending_prov["worker_id"],
                "request_id": request_id,
                "intent": job.effective_intent,
                "format_mode": job.effective_format_mode,
                "queue_position": queue_pos,
                "worker_available": XenWorkerHeartbeat.is_any_worker_online(),
                "lease_expired": job.is_lease_expired() is True,
                "provenance": pending_prov,
                "claimed_at": job.claimed_at.isoformat() if job.claimed_at else None,
                "created_at": job.created_at.isoformat(),
            },
            status=status.HTTP_200_OK,
        )


class XenStatusView(XenBaseView):
    """
    Returns the real-time operational status of the Xen GPU worker pool and queue depth.
    """
    def get(self, request):
        request_id = str(uuid.uuid4())
        user = request.user

        denial = self.cohort_denial(user, request_id)
        if denial:
            return denial

        worker_online = XenWorkerHeartbeat.is_any_worker_online()
        active_workers = XenWorkerHeartbeat.get_active_workers()
        queued_count = XenJob.objects.filter(status=XenJobStatus.QUEUED).count()
        running_count = XenJob.objects.filter(status__in=[XenJobStatus.CLAIMED, XenJobStatus.RUNNING]).count()

        return Response(
            {
                "status": "ok",
                "service": "pixiumind-xen",
                "assistant": "Xen",
                "model": "xen-step-700",
                "worker_online": worker_online,
                "active_worker_count": active_workers.count(),
                "queued_jobs": queued_count,
                "running_jobs": running_count,
                "request_id": request_id,
            },
            status=status.HTTP_200_OK,
        )


class XenWorkerBaseView(APIView):
    """
    Base view for Kaggle GPU outbound worker polling.
    Authenticates worker via shared secret (XEN_WORKER_SECRET) using constant-time comparison.
    """
    authentication_classes = []
    permission_classes = []

    def check_worker_auth(self, request):
        configured_secret = getattr(settings, "XEN_WORKER_SECRET", "").strip()
        if not configured_secret:
            logger.error("XEN_WORKER_SECRET is not configured on server. Rejecting worker request.")
            return Response(
                {"error": "Worker authentication is unconfigured on server.", "code": "WORKER_AUTH_UNCONFIGURED"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        auth_header = request.headers.get("Authorization", "").strip()
        worker_secret = request.headers.get("X-Worker-Secret", "").strip()
        if not worker_secret and auth_header.startswith("Bearer "):
            worker_secret = auth_header[7:].strip()

        if not worker_secret or not hmac.compare_digest(worker_secret, configured_secret):
            logger.warning("Worker authentication failed: invalid secret.")
            return Response(
                {"error": "Invalid worker authentication secret.", "code": "INVALID_WORKER_SECRET"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return None


def _extract_preserved_job_state(raw_payload: Any) -> Dict[str, Any]:
    if not isinstance(raw_payload, dict):
        return {}
    out: Dict[str, Any] = {}
    for pkey in ("context_meta", "grounding_envelope", "prior_unsupported_claims"):
        if pkey in raw_payload and raw_payload[pkey] is not None:
            out[pkey] = raw_payload[pkey]
    return out


class XenWorkerClaimView(XenWorkerBaseView):
    """
    Worker endpoint to atomically claim the oldest queued XenJob.
    Also recovers expired leases and updates worker heartbeat.
    """
    def post(self, request):
        auth_err = self.check_worker_auth(request)
        if auth_err:
            return auth_err

        worker_id = str(request.data.get("worker_id", "kaggle-gpu-worker-1")).strip() or "kaggle-gpu-worker-1"
        metadata = request.data.get("metadata", {})
        if not isinstance(metadata, dict):
            metadata = {}

        # 1. Record worker heartbeat
        XenWorkerHeartbeat.record_heartbeat(worker_id=worker_id, metadata=metadata)

        now = timezone.now()
        lease_duration = getattr(settings, "XEN_JOB_LEASE_SECONDS", 120)

        # 2. Recover expired leases
        with transaction.atomic():
            expired_jobs = XenJob.objects.select_for_update(skip_locked=True).filter(
                status__in=[XenJobStatus.CLAIMED, XenJobStatus.RUNNING],
                lease_expires_at__lt=now,
            )
            for exp_job in expired_jobs:
                if exp_job.claim_count >= 3:
                    exp_job.status = XenJobStatus.FAILED
                    exp_job.error_code = "LEASE_TIMEOUT_EXCEEDED"
                    exp_job.error_message = "Worker lease expired 3 times without completion"
                    exp_job.completed_at = now
                    exp_job.save(update_fields=["status", "error_code", "error_message", "completed_at", "updated_at"])
                    logger.warning("Job %s marked failed after 3 lease timeouts", exp_job.id)
                else:
                    exp_job.status = XenJobStatus.QUEUED
                    exp_job.worker_id = ""
                    exp_job.response_payload = _extract_preserved_job_state(exp_job.response_payload)
                    exp_job.claimed_at = None
                    exp_job.lease_expires_at = None
                    exp_job.heartbeat_at = None
                    exp_job.save(update_fields=["response_payload", "status", "worker_id", "claimed_at", "lease_expires_at", "heartbeat_at", "updated_at"])
                    logger.info("Job %s lease expired; requeued for next worker", exp_job.id)

        # 3. Atomically claim oldest queued job
        with transaction.atomic():
            job = (
                XenJob.objects.select_for_update(skip_locked=True)
                .filter(status=XenJobStatus.QUEUED)
                .order_by("created_at")
                .first()
            )
            if not job:
                return Response({"status": "idle", "job": None}, status=status.HTTP_200_OK)

            preserved_claim_payload = _extract_preserved_job_state(job.response_payload)
            job.status = XenJobStatus.CLAIMED
            job.worker_id = worker_id
            job.response_payload = preserved_claim_payload
            job.claim_count += 1
            job.claimed_at = now
            job.lease_expires_at = now + timedelta(seconds=lease_duration)
            job.heartbeat_at = now
            job.save(update_fields=["response_payload", "status", "worker_id", "claim_count", "claimed_at", "lease_expires_at", "heartbeat_at", "updated_at"])

        return Response(
            {
                "status": "claimed",
                "job": {
                    "id": str(job.id),
                    "prompt": job.prompt,
                    "history": job.history,
                    "system_prompt": COMPOSITE_SYSTEM_PROMPT,
                    "max_tokens": job.max_tokens,
                    "temperature": job.temperature,
                    "intent": job.effective_intent,
                    "format_mode": job.effective_format_mode,
                    "lease_expires_at": job.lease_expires_at.isoformat(),
                },
            },
            status=status.HTTP_200_OK,
        )


class XenActiveJobView(XenWorkerBaseView):
    """Serialize callbacks with claim recovery and reject stale leases."""
    def post(self, request, job_id):
        auth_err = self.check_worker_auth(request)
        if auth_err:
            return auth_err
        if not isinstance(request.data, dict):
            return Response({"code": "INVALID_BODY"}, status=400)
        worker_id = request.data.get("worker_id")
        with transaction.atomic():
            try:
                job = XenJob.objects.select_for_update().get(id=job_id)
            except (XenJob.DoesNotExist, ValueError):
                return Response({"code": "JOB_NOT_FOUND"}, status=404)
            if not worker_id or worker_id != job.worker_id:
                return Response({"code": "WORKER_MISMATCH"}, status=409)
            if (job.status not in (XenJobStatus.CLAIMED, XenJobStatus.RUNNING)
                    or not job.lease_expires_at or job.lease_expires_at <= timezone.now()):
                return Response({"code": "JOB_NOT_ACTIVE"}, status=409)
            return self.update_job(request, job, worker_id)


class XenWorkerHeartbeatView(XenActiveJobView):
    """Worker endpoint to extend lease on a running job and register active worker heartbeat."""
    def update_job(self, request, job, worker_id):
        now = timezone.now()
        lease_duration = getattr(settings, "XEN_JOB_LEASE_SECONDS", 120)
        job.status = XenJobStatus.RUNNING
        job.heartbeat_at = now
        job.lease_expires_at = now + timedelta(seconds=lease_duration)
        job.save(update_fields=["status", "heartbeat_at", "lease_expires_at", "updated_at"])

        metadata = request.data.get("metadata") if isinstance(request.data.get("metadata"), dict) else None
        XenWorkerHeartbeat.record_heartbeat(worker_id=worker_id or job.worker_id, metadata=metadata)
        return Response({"status": "ok", "lease_expires_at": job.lease_expires_at.isoformat()}, status=status.HTTP_200_OK)


class XenWorkerCompleteView(XenActiveJobView):
    """Worker endpoint to report completed inference results for a job."""
    def update_job(self, request, job, worker_id):
        usage = request.data.get("usage", {})
        if not isinstance(usage, dict):
            return Response({"code": "INVALID_COMPLETION"}, status=400)
        usage = {key: usage.get(key, 0) for key in ("prompt_tokens", "completion_tokens", "total_tokens")}
        if any(type(value) is not int or value < 0 for value in usage.values()):
            return Response({"code": "INVALID_COMPLETION"}, status=400)
        output = request.data
        if "choices" in output:
            choices = output["choices"]
            if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
                return Response({"code": "INVALID_COMPLETION"}, status=400)
            output = choices[0]
        message = output.get("message", {})
        if not isinstance(message, dict):
            return Response({"code": "INVALID_COMPLETION"}, status=400)
        raw_text = message.get("content") or output.get("raw_response") or output.get("text") or output.get("content")
        finish_reason = output.get("finish_reason", "stop")
        if not isinstance(raw_text, str) or not raw_text.strip() or len(raw_text) > 65536 or not isinstance(finish_reason, str):
            return Response({"code": "INVALID_COMPLETION"}, status=400)

        fmt_mode = job.effective_format_mode
        decoded = decode_model_response(
            raw_text=raw_text,
            finish_reason=finish_reason,
            actually_executed=False,
            intent=job.effective_intent,
            format_mode=fmt_mode,
        )
        if not isinstance(decoded.get("text"), str) or not decoded["text"].strip():
            return Response({"code": "INVALID_COMPLETION"}, status=400)

        now = timezone.now()

        existing_payload = job.response_payload if isinstance(job.response_payload, dict) else {}
        preserved_retry_meta = existing_payload.get("context_meta")
        preserved_grounding_env = existing_payload.get("grounding_envelope")
        prior_unsupported_claims = list(existing_payload.get("prior_unsupported_claims") or [])

        # Specification Part 9.2: One-time retry if response violates CODE_ONLY format
        if fmt_mode == "CODE_ONLY" and not decoded.get("format_valid", True) and job.claim_count == 1:
            logger.warning(
                "Job %s failed CODE_ONLY validation on attempt 1 (%s); requeueing for one-time retry",
                job.id, decoded.get("format_error"),
            )
            strict_retry_directive = (
                "MANDATORY STRICT RETRY DIRECTIVE:\n"
                "Your previous response violated the CODE_ONLY format requirement.\n"
                "You must return EXCLUSIVELY the single ```python ... ``` code block.\n"
                "Do NOT include any greetings, prose, comments, or explanations.\n"
                "Output ONLY the code fence."
            )
            base_prompt = job.prompt or ""
            for prefix_tag in ("[RESPONSE MODE:", "[MODE:"):
                if base_prompt.startswith(prefix_tag):
                    close_idx = base_prompt.find("]\n\n")
                    if close_idx != -1:
                        base_prompt = base_prompt[close_idx + 3:]
                        break
            candidate_prompt = f"[{strict_retry_directive}]\n\n{base_prompt}"
            if len(candidate_prompt) > 4000:
                short_retry_directive = "MANDATORY STRICT RETRY DIRECTIVE: Output ONLY the code fence, zero prose or comments."
                candidate_prompt = f"[{short_retry_directive}]\n\n{base_prompt}"
            if len(candidate_prompt) > 4000 and "[/MISSION CONTEXT]\n\n" in base_prompt:
                after_ctx = base_prompt.split("[/MISSION CONTEXT]\n\n", 1)[1]
                candidate_prompt = f"[{short_retry_directive}]\n\n{after_ctx}"
            if len(candidate_prompt) > 4000:
                candidate_prompt = candidate_prompt[:4000]
            retry_payload_state: Dict[str, Any] = {}
            if preserved_retry_meta:
                retry_payload_state["context_meta"] = preserved_retry_meta
            if preserved_grounding_env is not None:
                retry_payload_state["grounding_envelope"] = preserved_grounding_env
            if prior_unsupported_claims:
                retry_payload_state["prior_unsupported_claims"] = prior_unsupported_claims
            job.prompt = candidate_prompt
            job.response_payload = retry_payload_state
            job.status = XenJobStatus.QUEUED
            job.worker_id = ""
            job.claimed_at = None
            job.lease_expires_at = None
            job.heartbeat_at = None
            job.save(update_fields=["response_payload", "prompt", "status", "worker_id", "claimed_at", "lease_expires_at", "heartbeat_at", "updated_at"])
            return Response({"status": "requeued_for_retry", "job_id": str(job.id)}, status=status.HTTP_200_OK)

        # Phase 2 Post-Generation Grounding Verifier for async worker completion
        grounding_verification: Optional[Dict[str, Any]] = None
        if isinstance(preserved_grounding_env, dict):
            spec = build_authoritative_grounding_spec(preserved_grounding_env)
            if spec.get("has_circuit"):
                g_check = extract_and_validate_grounding_claims(decoded["text"], spec, job.prompt or "")
                all_unsupported = list(dict.fromkeys(prior_unsupported_claims + list(g_check["unsupported_claims"])))
                is_first_attempt = getattr(job, "claim_count", 1) == 1

                if not g_check["verified"] and is_first_attempt:
                    logger.warning(
                        "Job %s failed grounding check on attempt 1 (%s); requeueing for single constrained retry",
                        job.id, g_check["unsupported_claims"][:3],
                    )
                    constrained_prompt = build_constrained_regeneration_prompt(
                        job.prompt or "",
                        g_check["unsupported_claims"],
                        spec,
                        format_mode_value=fmt_mode,
                        max_chars=4000,
                    )
                    requeue_payload: Dict[str, Any] = {
                        "grounding_envelope": preserved_grounding_env,
                        "prior_unsupported_claims": all_unsupported,
                    }
                    if preserved_retry_meta:
                        requeue_payload["context_meta"] = preserved_retry_meta
                    job.prompt = constrained_prompt
                    job.response_payload = requeue_payload
                    job.status = XenJobStatus.QUEUED
                    job.worker_id = ""
                    job.claimed_at = None
                    job.lease_expires_at = None
                    job.heartbeat_at = None
                    job.save(update_fields=["response_payload", "prompt", "status", "worker_id", "claimed_at", "lease_expires_at", "heartbeat_at", "updated_at"])
                    return Response(
                        {
                            "status": "requeued_for_retry",
                            "reason": "grounding_verification",
                            "unsupported_claims": g_check["unsupported_claims"],
                            "job_id": str(job.id),
                        },
                        status=status.HTTP_200_OK,
                    )

                fallback_applied = False
                retry_attempted = len(prior_unsupported_claims) > 0 or getattr(job, "claim_count", 1) > 1
                if not g_check["verified"]:
                    fallback_applied = True
                    fallback_text = build_deterministic_grounded_fallback(
                        spec,
                        job.prompt or "",
                        decoded["text"],
                        all_unsupported,
                        g_check["unsupported_clauses"],
                    )
                    decoded = {
                        **decoded,
                        "text": fallback_text,
                        "is_complete": True,
                        "completion_status": "GROUNDING_FALLBACK",
                    }

                grounding_verification = {
                    "verified": True,
                    "model_verified": not fallback_applied,
                    "initial_verified": bool(g_check["verified"] and not retry_attempted),
                    "retry_attempted": retry_attempted,
                    "fallback_applied": fallback_applied,
                    "final_output_source": (
                        "deterministic_grounded_fallback"
                        if fallback_applied
                        else ("xen_retry" if retry_attempted else "xen_step700")
                    ),
                    "circuit_revision": spec.get("circuit_revision"),
                    "unsupported_claims": all_unsupported,
                    "claim_ledger": list(g_check["claim_ledger"])[:24],
                }

        existing_chunks = existing_payload.get("chunks", [])
        preserved_complete_meta = existing_payload.get("context_meta")
        job.status = XenJobStatus.COMPLETED
        job.completed_at = now
        job.response_summary = decoded["text"]
        completed_payload: Dict[str, Any] = {
            "decoded": {k: v for k, v in decoded.items() if k != "raw_text"},
            "finish_reason": finish_reason,
            "usage": usage,
            "worker_id": worker_id or job.worker_id,
            "chunks": existing_chunks,
            "delivery_mode": "incremental" if existing_chunks else "batch_fallback",
        }
        if preserved_complete_meta:
            completed_payload["context_meta"] = preserved_complete_meta
        if grounding_verification is not None:
            completed_payload["grounding_verification"] = grounding_verification
        job.response_payload = completed_payload
        job.save(update_fields=["status", "completed_at", "response_summary", "response_payload", "updated_at"])

        XenWorkerHeartbeat.record_heartbeat(worker_id=worker_id or job.worker_id)
        return Response({"status": "completed", "job_id": str(job.id)}, status=status.HTTP_200_OK)


class XenWorkerChunkView(XenActiveJobView):
    """
    Worker endpoint to append streaming token chunks to an active job.
    Called incrementally by the worker as tokens are generated.
    """
    def update_job(self, request, job, worker_id):
        seq = request.data.get("seq")
        delta = request.data.get("delta")
        if type(seq) is not int or not 1 <= seq <= 2048 or not isinstance(delta, str) or not 0 < len(delta) <= 4096:
            return Response({"code": "INVALID_CHUNK"}, status=400)
        payload = job.response_payload or {}
        chunks = payload.get("chunks", [])
        if seq <= len(chunks) and chunks[seq - 1]["delta"] == delta:
            return Response({"status": "ok", "seq": seq})
        if seq != len(chunks) + 1:
            return Response({"code": "CHUNK_SEQUENCE_CONFLICT"}, status=409)
        if sum(len(chunk["delta"]) for chunk in chunks) + len(delta) > 65536:
            return Response({"code": "STREAM_TOO_LARGE"}, status=400)
        chunks.append({"seq": seq, "delta": delta, "ts": timezone.now().timestamp()})
        job.response_payload = {**payload, "chunks": chunks, "delivery_mode": "incremental"}
        job.save(update_fields=["response_payload", "updated_at"])
        return Response({"status": "ok", "seq": seq}, status=status.HTTP_200_OK)


class XenJobChunksView(XenBaseView):
    """
    Retrieves real-time token chunks for a XenJob.
    Allows clients to stream response tokens with low latency (250-350ms cursor polling).
    """
    def get(self, request, job_id):
        request_id = str(uuid.uuid4())
        user = request.user

        denial = self.cohort_denial(user, request_id)
        if denial:
            return denial

        try:
            job = XenJob.objects.get(id=job_id)
        except (XenJob.DoesNotExist, ValueError):
            return Response(
                {"error": "Job not found.", "code": "JOB_NOT_FOUND", "request_id": request_id},
                status=status.HTTP_404_NOT_FOUND,
            )

        if job.user_id != user.id and getattr(user, "role", "") != UserRole.ADMIN:
            return Response(
                {"error": "Job not found.", "code": "JOB_NOT_FOUND", "request_id": request_id},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            after_seq = int(request.query_params.get("after", 0))
        except (ValueError, TypeError):
            after_seq = 0

        payload = job.response_payload if isinstance(job.response_payload, dict) else {}
        if "attempt" in request.query_params and request.query_params["attempt"] != str(job.claim_count):
            after_seq = 0
        all_chunks = payload.get("chunks", [])
        filtered_chunks = [c for c in all_chunks if c.get("seq", 0) > after_seq]

        queue_pos = 0
        if job.status == XenJobStatus.QUEUED:
            queue_pos = XenJob.objects.filter(status=XenJobStatus.QUEUED, created_at__lte=job.created_at).count()

        provenance = _job_provenance(
            job,
            response_source=(
                "xen_step700"
                if job.status == XenJobStatus.COMPLETED
                else "error"
                if job.status in (XenJobStatus.FAILED, XenJobStatus.EXPIRED, XenJobStatus.CANCELLED)
                else "xen_step700"
            ),
            response_status=job.status,
            fallback_reason=(
                (job.error_code or job.status.upper())
                if job.status in (XenJobStatus.FAILED, XenJobStatus.EXPIRED, XenJobStatus.CANCELLED)
                else None
            ),
        )

        response_data: Dict[str, Any] = {
            "job_id": str(job.id),
            "worker_id": provenance["worker_id"],
            "status": job.status,
            "chunks": filtered_chunks,
            "assistant": "Xen",
            "model": "xen-step-700",
            "intent": job.effective_intent,
            "format_mode": job.effective_format_mode,
            "usage": payload.get("usage", {}),
            "attempt": job.claim_count,
            "delivery_mode": payload.get("delivery_mode", "batch_fallback" if job.status == XenJobStatus.COMPLETED else "pending"),
            "is_complete": job.status == XenJobStatus.COMPLETED,
            "is_failed": job.status == XenJobStatus.FAILED,
            "queue_position": queue_pos,
            "worker_available": XenWorkerHeartbeat.is_any_worker_online(),
            "lease_expired": job.is_lease_expired() is True,
            "provenance": provenance,
            "request_id": request_id,
        }

        if job.status == XenJobStatus.COMPLETED:
            decoded = payload.get("decoded", {})
            if isinstance(payload.get("grounding_verification"), dict):
                response_data["grounding_verification"] = payload["grounding_verification"]
            response_data["response"] = {
                "text": job.response_summary,
                "is_complete": decoded.get("is_complete", True),
                "completion_status": decoded.get("completion_status", "complete"),
                "syntax_valid": decoded.get("syntax_valid", True),
                "display_ast_valid": decoded.get("display_ast_valid", False if job.effective_format_mode == "CODE_ONLY" else True),
                "format_valid": decoded.get("format_valid", True),
                "tested": decoded.get("tested", False),
                "code_leakage_detected": decoded.get("code_leakage_in_explanation", False),
            }
            response_data["completed_at"] = job.completed_at.isoformat() if job.completed_at else None

        elif job.status == XenJobStatus.FAILED:
            response_data["error"] = {
                "code": job.error_code or "INFERENCE_FAILED",
                "message": "Inference failed on the GPU worker.",
            }

        return Response(response_data, status=status.HTTP_200_OK, headers={"Cache-Control": "private, no-store"})


class XenWorkerFailView(XenActiveJobView):
    """Worker endpoint to report inference failure for a job."""
    def update_job(self, request, job, worker_id):
        now = timezone.now()
        job.status = XenJobStatus.FAILED
        job.completed_at = now
        job.error_code = "CUDA_OUT_OF_MEMORY" if request.data.get("error_code") == "CUDA_OUT_OF_MEMORY" else "WORKER_EXECUTION_ERROR"
        job.error_message = "Inference failed on the GPU worker."
        job.save(update_fields=["status", "error_code", "error_message", "completed_at", "updated_at"])

        XenWorkerHeartbeat.record_heartbeat(worker_id=worker_id or job.worker_id)
        return Response({"status": "failed", "job_id": str(job.id)}, status=status.HTTP_200_OK)


class XenCyberLabContextView(XenBaseView):
    """
    User-scoped endpoint for syncing and retrieving live CyberLab circuit and
    wire construction snapshots across Gunicorn workers without exposing
    cross-user context, secrets, or stale overwrites.
    """
    throttle_classes = []
    MAX_BODY_BYTES = 131_072

    def get(self, request):
        request_id = f"xen-ctx-{uuid.uuid4().hex[:12]}"
        user = request.user
        if denial := self.cohort_denial(user, request_id):
            return denial

        is_allowed, _, rl_error = check_xen_rate_limit(f"{user.id}:cyberlab_ctx", limit=180, window_seconds=60)
        if not is_allowed:
            return Response(
                {
                    "error": "Rate limit exceeded." if rl_error == "RATE_LIMIT_EXCEEDED" else "Shared rate limiter is unavailable.",
                    "code": rl_error or "RATE_LIMITER_UNAVAILABLE",
                    "request_id": request_id,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS if rl_error == "RATE_LIMIT_EXCEEDED" else status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        XenCyberLabContext.prune_expired()
        now = timezone.now()
        session_id = request.query_params.get("session_id")
        if session_id is not None:
            session_id = str(session_id).strip()
            if not _CYBERLAB_SESSION_RE.match(session_id):
                return Response(
                    {"error": "Invalid session_id.", "code": "INVALID_SESSION_ID", "request_id": request_id},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            ctx = XenCyberLabContext.objects.filter(user=user, session_id=session_id, expires_at__gt=now).first()
        else:
            ctx = XenCyberLabContext.objects.filter(user=user, expires_at__gt=now).order_by("-updated_at").first()

        if ctx is None:
            return Response(
                {"error": "CyberLab session context not found.", "code": "CONTEXT_NOT_FOUND", "request_id": request_id},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {
                "session_id": ctx.session_id,
                "circuit_revision": ctx.circuit_revision,
                "interaction_revision": ctx.interaction_revision,
                "event_seq": ctx.event_seq,
                "last_event_id": ctx.last_event_id,
                "last_event_type": ctx.last_event_type,
                "expires_at": ctx.expires_at.isoformat(),
                "updated_at": ctx.updated_at.isoformat(),
                "context_envelope": ctx.context_payload,
                "request_id": request_id,
            },
            status=status.HTTP_200_OK,
            headers={"Cache-Control": "private, no-store"},
        )

    def post(self, request):
        request_id = f"xen-ctx-{uuid.uuid4().hex[:12]}"
        user = request.user
        if denial := self.cohort_denial(user, request_id):
            return denial

        is_allowed, _, rl_error = check_xen_rate_limit(f"{user.id}:cyberlab_ctx", limit=180, window_seconds=60)
        if not is_allowed:
            return Response(
                {
                    "error": "Rate limit exceeded." if rl_error == "RATE_LIMIT_EXCEEDED" else "Shared rate limiter is unavailable.",
                    "code": rl_error or "RATE_LIMITER_UNAVAILABLE",
                    "request_id": request_id,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS if rl_error == "RATE_LIMIT_EXCEEDED" else status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        raw_body = getattr(request, "body", b"") or b""
        if len(raw_body) > self.MAX_BODY_BYTES:
            return Response(
                {"error": "Context payload exceeds 128KB maximum size.", "code": "PAYLOAD_TOO_LARGE", "request_id": request_id},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(request.data, Mapping):
            return Response(
                {"error": "JSON object required.", "code": "INVALID_REQUEST", "request_id": request_id},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session_id = request.data.get("session_id")
        if not isinstance(session_id, str) or not _CYBERLAB_SESSION_RE.match(session_id.strip()):
            return Response(
                {"error": "Valid session_id is required.", "code": "INVALID_SESSION_ID", "request_id": request_id},
                status=status.HTTP_400_BAD_REQUEST,
            )
        session_id = session_id.strip()

        event_type = request.data.get("event_type", "circuit_snapshot")
        if not isinstance(event_type, str) or event_type not in _CYBERLAB_ALLOWED_EVENTS:
            return Response(
                {"error": "Unsupported CyberLab context event_type.", "code": "INVALID_EVENT_TYPE", "request_id": request_id},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event_id = request.data.get("event_id", "")
        if event_id is not None and (not isinstance(event_id, str) or len(event_id) > 128 or "\x00" in event_id):
            return Response(
                {"error": "Invalid event_id.", "code": "INVALID_EVENT_ID", "request_id": request_id},
                status=status.HTTP_400_BAD_REQUEST,
            )
        event_id = (event_id or "").strip()

        c_rev = request.data.get("circuit_revision", 0)
        i_rev = request.data.get("interaction_revision", 0)
        e_seq = request.data.get("event_seq", 0)
        for name, val in (("circuit_revision", c_rev), ("interaction_revision", i_rev), ("event_seq", e_seq)):
            if type(val) is not int or not (0 <= val <= 10_000_000):
                return Response(
                    {"error": f"{name} must be a non-negative integer.", "code": "INVALID_REVISION", "request_id": request_id},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        raw_env = request.data.get("context_envelope")
        if raw_env is not None and not isinstance(raw_env, dict):
            return Response(
                {"error": "context_envelope must be an object.", "code": "INVALID_CONTEXT_ENVELOPE", "request_id": request_id},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sanitized_payload = sanitize_context_envelope(raw_env or {})
        sanitized_payload["session_id"] = session_id
        sanitized_payload["circuit_revision"] = c_rev
        sanitized_payload["interaction_revision"] = i_rev
        sanitized_payload["state_revision"] = c_rev + i_rev
        sanitized_payload["event_seq"] = e_seq
        if event_id:
            sanitized_payload["event_id"] = event_id
        if event_type in {"wire_cancel", "wire_complete", "wire_delete", "session_reset"}:
            sanitized_payload = _clear_draft_in_sanitized(sanitized_payload)

        incoming_tuple = (c_rev, i_rev, e_seq)
        XenCyberLabContext.prune_expired()

        with transaction.atomic():
            existing = (
                XenCyberLabContext.objects
                .select_for_update()
                .filter(user=user, session_id=session_id)
                .first()
            )
            if existing is not None:
                if event_id and existing.last_event_id == event_id:
                    return Response(
                        {
                            "status": "duplicate_ignored",
                            "session_id": session_id,
                            "circuit_revision": existing.circuit_revision,
                            "interaction_revision": existing.interaction_revision,
                            "event_seq": existing.event_seq,
                            "request_id": request_id,
                        },
                        status=status.HTTP_200_OK,
                    )
                if event_type != "session_reset" and incoming_tuple < existing.revision_tuple():
                    return Response(
                        {
                            "error": "Stale circuit context revision rejected.",
                            "code": "STALE_CONTEXT_REVISION",
                            "current_revision": list(existing.revision_tuple()),
                            "received_revision": list(incoming_tuple),
                            "request_id": request_id,
                        },
                        status=status.HTTP_409_CONFLICT,
                    )
                existing.circuit_revision = c_rev
                existing.interaction_revision = i_rev
                existing.event_seq = e_seq
                existing.last_event_id = event_id
                existing.last_event_type = event_type
                existing.context_payload = sanitized_payload
                existing.expires_at = XenCyberLabContext.default_expiry()
                existing.save(update_fields=[
                    "circuit_revision", "interaction_revision", "event_seq",
                    "last_event_id", "last_event_type", "context_payload",
                    "expires_at", "updated_at",
                ])
                ctx = existing
            else:
                ctx = XenCyberLabContext.objects.create(
                    user=user,
                    session_id=session_id,
                    circuit_revision=c_rev,
                    interaction_revision=i_rev,
                    event_seq=e_seq,
                    last_event_id=event_id,
                    last_event_type=event_type,
                    context_payload=sanitized_payload,
                    expires_at=XenCyberLabContext.default_expiry(),
                )

        return Response(
            {
                "status": "synced",
                "session_id": ctx.session_id,
                "circuit_revision": ctx.circuit_revision,
                "interaction_revision": ctx.interaction_revision,
                "event_seq": ctx.event_seq,
                "last_event_type": ctx.last_event_type,
                "expires_at": ctx.expires_at.isoformat(),
                "request_id": request_id,
            },
            status=status.HTTP_200_OK,
            headers={"Cache-Control": "private, no-store"},
        )

