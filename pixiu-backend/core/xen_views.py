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

from accounts.models import UserRole
from accounts.permissions import IsActiveAccount
from academics.models_xen import XenSession, XenJob, XenJobStatus, XenWorkerHeartbeat
from core.xen_decoder import decode_model_response
from core.xen_intent import (
    XenResponseMode,
    resolve_xen_response_mode,
    get_additive_mode_instruction,
    sanitize_context_envelope,
    format_context_envelope,
)
from core.xen_ratelimit import check_xen_rate_limit

logger = logging.getLogger("security.xen")

# Authoritative Condition A1 System Prompt for PixiuMind 1.4 / Step-700
CONDITION_A1_SYSTEM_PROMPT = (
    "You are a friendly, age-appropriate teacher for Grade 6 Computational Thinking. Explain concepts clearly with step-by-step reasoning, address student misconceptions warmly, and connect ideas to practical, real-world examples.\n\n"
    "When a student explicitly requests an implementation, program, or code solution, always provide the complete, correct, and executable Python code in a properly formatted ```python code block, followed by a concise, student-friendly explanation. Never substitute conceptual discussion alone for requested code."
)

# Authoritative Canonical Identity Grounding for 8square AI / Xen Step-700
CANONICAL_8SQUARE_IDENTITY = (
    "You are 8square, an AI assistant developed by PixiuTech. You are powered by the Xen model, currently running Xen Step-700.\n"
    "Your assistant identity is 8square. Your underlying model identity is Xen.\n"
    "When users ask who you are, identify yourself as 8square. When users ask which model powers you, identify Xen. Never introduce yourself as PixiuMind Xen, PixiuMind Xen Tutor, or Qwen.\n"
    "Maintain your existing educational, reasoning, computational-thinking and programming capabilities. Follow the original pedagogical system instructions."
)

COMPOSITE_SYSTEM_PROMPT = f"{CANONICAL_8SQUARE_IDENTITY}\n\n{CONDITION_A1_SYSTEM_PROMPT}"


def sanitize_xen_message(content):
    content = content.replace("\x00", "")
    while True:
        cleaned = content
        for delimiter in ("<|im_start|>", "<|im_end|>", "<|endoftext|>"):
            cleaned = cleaned.replace(delimiter, "")
        if cleaned == content:
            return cleaned.strip()
        content = cleaned


def compact_xen_history(history: List[Dict[str, Any]], active_mode: XenResponseMode) -> List[Dict[str, Any]]:
    """
    Specification Part 8:
    History management and compaction.
    Preserves:
    - All relevant user requirements and instructions.
    - Active format preferences and corrections.
    - Code context from prior turns.
    Prunes:
    - Verbose explanatory paragraphs and redundant repetitive assistant text.
    - Failed previous assistant answers that violated format contracts.
    """
    compacted = []
    for turn in history:
        role = turn.get("role")
        content = turn.get("content", "")
        if role == "user":
            compacted.append({"role": "user", "content": sanitize_xen_message(content)})
        elif role == "assistant":
            code_blocks = re.findall(r"```(?:[a-zA-Z0-9_-]*)\n([\s\S]*?)```", content)
            if code_blocks:
                lang_match = re.search(r"```([a-zA-Z0-9_-]*)\n", content)
                lang = lang_match.group(1) if lang_match else "python"
                compact_turn = f"```{lang}\n{code_blocks[0].strip()}\n```"
                compacted.append({"role": "assistant", "content": sanitize_xen_message(compact_turn)})
            else:
                trimmed = content.strip()
                if len(trimmed) > 200:
                    trimmed = trimmed[:200] + "..."
                compacted.append({"role": "assistant", "content": sanitize_xen_message(trimmed)})
    return compacted



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

        # 8. Resolve response format mode and compact history (Specifications Part 5, 6, 7, 8)
        format_pref = request.data.get("format_preference")
        format_mode, mode_source = resolve_xen_response_mode(
            prompt, history=history, active_sticky_preference=format_pref
        )

        compacted_history = compact_xen_history(history, format_mode)
        mode_directive = get_additive_mode_instruction(format_mode)

        # Context envelope handling (sanitized mission & circuit context)
        context_envelope_raw = request.data.get("context_envelope")
        context_envelope = sanitize_context_envelope(context_envelope_raw)
        context_prefix = format_context_envelope(context_envelope)

        effective_prompt = prompt
        if context_prefix:
            effective_prompt = f"{context_prefix}\n\n{effective_prompt}"
        if mode_directive:
            effective_prompt = f"[{mode_directive}]\n\n{effective_prompt}"

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
            cached = True

        if not cached:
            persisted = False
            try:
                start_time = time.monotonic()
                code, upstream_resp = self.call_upstream(
                    "/v1/chat/completions", method="POST", payload=upstream_payload,
                )
                if code != 200:
                    return Response({**upstream_resp, "request_id": request_id}, status=code)

                try:
                    first_choice = upstream_resp["choices"][0]
                    raw_text = first_choice["message"]["content"]
                    finish_reason = first_choice.get("finish_reason", "stop")
                    usage = upstream_resp.get("usage", {})
                    if (
                        not isinstance(raw_text, str)
                        or not raw_text.strip()
                        or finish_reason not in ("stop", "end_turn", "eos_token", "length")
                        or not isinstance(usage, dict)
                    ):
                        raise TypeError("Invalid completion response fields")
                except (AttributeError, IndexError, KeyError, TypeError):
                    logger.warning("Invalid upstream completion response for %s", request_id)
                    return Response(
                        {"error": "Invalid response from the model.", "code": "INVALID_UPSTREAM_RESPONSE", "request_id": request_id},
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
                    "xen_metadata": {
                        "request_id": request_id,
                        "status": "ok",
                        "intent": intent,
                        "format_mode": format_mode.value,
                        **({"cached": True} if cached else {}),
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
                "assistant": "8square",
                "model": model_id,
                "intent": intent,
                "format_mode": format_mode.value,
                **({"cached": True} if cached else {}),
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

        # 5. Resolve format mode and compact history (Specifications Part 5, 6, 7, 8)
        format_pref = request.data.get("format_preference")
        format_mode, mode_source = resolve_xen_response_mode(
            prompt, history=history, active_sticky_preference=format_pref
        )

        compacted_history = compact_xen_history(history, format_mode)
        mode_directive = get_additive_mode_instruction(format_mode)

        # Context envelope handling (sanitized mission & circuit context)
        # Budget context body dynamically so [mode_directive] + context + prompt fits V11 4000-char limit.
        effective_mode_directive = mode_directive
        if effective_mode_directive and len(effective_mode_directive) + 4 + len(prompt) > 4000:
            compact_directives = {
                "CODE_ONLY": "MODE: CODE ONLY — output only one executable code fence, zero prose.",
                "OUTPUT_ONLY": "MODE: OUTPUT ONLY — return only expected output.",
                "EXPLANATION_ONLY": "MODE: EXPLANATION ONLY — conceptual prose only, no code blocks.",
                "CODE_AND_EXPLANATION": "MODE: CODE + EXPLANATION — working code plus concise explanation.",
            }
            compact = compact_directives.get(format_mode.value, "")
            if compact and len(compact) + 4 + len(prompt) <= 4000:
                effective_mode_directive = compact

        mode_overhead = (len(effective_mode_directive) + 4) if effective_mode_directive else 0
        # wrapper overhead in format_context_envelope is 92 chars + "\n\n" separator (2 chars)
        max_context_body = 4000 - len(prompt) - mode_overhead - 94

        context_envelope_raw = request.data.get("context_envelope")
        context_envelope = sanitize_context_envelope(context_envelope_raw)
        context_prefix = format_context_envelope(context_envelope, max_chars=max_context_body) if max_context_body >= 40 else ""

        effective_prompt = prompt
        if context_prefix:
            effective_prompt = f"{context_prefix}\n\n{effective_prompt}"
        if effective_mode_directive:
            effective_prompt = f"[{effective_mode_directive}]\n\n{effective_prompt}"

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
            job, created = XenJob.objects.get_or_create(
                user=user, idempotency_key=idempotency_key,
                defaults={"role": role, "intent": intent, "format_mode": format_mode.value, "status": XenJobStatus.QUEUED,
                          "request_hash": request_hash, "prompt": effective_prompt, "history": compacted_history,
                          "max_tokens": max_tokens, "temperature": temperature},
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
                return Response(
                    {
                        "status": "completed",
                        "job_id": str(job.id),
                        "request_id": request_id,
                        "model": "pixiumind-1.4-d14-step700",
                        "intent": job.effective_intent,
                        "format_mode": job.effective_format_mode,
                        "cached": True,
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
                return Response(
                    {
                        "status": job.status,
                        "job_id": str(job.id),
                        "request_id": request_id,
                        "idempotency_key": idempotency_key,
                        "intent": job.effective_intent,
                        "format_mode": job.effective_format_mode,
                        "worker_available": worker_online,
                        "queue_position": queue_pos,
                        "created_at": job.created_at.isoformat(),
                    },
                    status=status.HTTP_202_ACCEPTED,
                )

        worker_online = XenWorkerHeartbeat.is_any_worker_online()
        queue_pos = XenJob.objects.filter(status=XenJobStatus.QUEUED, created_at__lte=job.created_at).count()

        return Response(
            {
                "status": "queued",
                "job_id": str(job.id),
                "request_id": request_id,
                "idempotency_key": idempotency_key,
                "intent": job.effective_intent,
                "format_mode": job.effective_format_mode,
                "worker_available": worker_online,
                "queue_position": queue_pos,
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
            return Response(
                {
                    "status": "completed",
                    "job_id": str(job.id),
                    "request_id": request_id,
                    "assistant": "8square",
                    "model": "xen-step-700",
                    "intent": job.effective_intent,
                    "format_mode": job.effective_format_mode,
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
            return Response(
                {
                    "status": "failed",
                    "job_id": str(job.id),
                    "request_id": request_id,
                    "error": {
                        "code": job.error_code or "INFERENCE_FAILED",
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

        return Response(
            {
                "status": job.status,
                "job_id": str(job.id),
                "request_id": request_id,
                "intent": job.effective_intent,
                "format_mode": job.effective_format_mode,
                "queue_position": queue_pos,
                "worker_available": XenWorkerHeartbeat.is_any_worker_online(),
                "lease_expired": job.is_lease_expired() is True,
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
                "assistant": "8square",
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
                    exp_job.response_payload = {}
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

            job.status = XenJobStatus.CLAIMED
            job.worker_id = worker_id
            job.response_payload = {}
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

        now = timezone.now()

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
            job.prompt = candidate_prompt
            job.response_payload = {}
            job.status = XenJobStatus.QUEUED
            job.worker_id = ""
            job.claimed_at = None
            job.lease_expires_at = None
            job.heartbeat_at = None
            job.save(update_fields=["response_payload", "prompt", "status", "worker_id", "claimed_at", "lease_expires_at", "heartbeat_at", "updated_at"])
            return Response({"status": "requeued_for_retry", "job_id": str(job.id)}, status=status.HTTP_200_OK)

        existing_chunks = []
        if isinstance(job.response_payload, dict):
            existing_chunks = job.response_payload.get("chunks", [])
        job.status = XenJobStatus.COMPLETED
        job.completed_at = now
        job.response_summary = decoded["text"]
        job.response_payload = {
            "decoded": {k: v for k, v in decoded.items() if k != "raw_text"},
            "finish_reason": finish_reason,
            "usage": usage,
            "worker_id": worker_id or job.worker_id,
            "chunks": existing_chunks,
            "delivery_mode": "incremental" if existing_chunks else "batch_fallback",
        }
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

        response_data: Dict[str, Any] = {
            "job_id": str(job.id),
            "status": job.status,
            "chunks": filtered_chunks,
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
            "request_id": request_id,
        }

        if job.status == XenJobStatus.COMPLETED:
            decoded = payload.get("decoded", {})
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

