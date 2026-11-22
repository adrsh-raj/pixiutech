"""
PixiuTech Django Views for Xen (PixiuMind Step-700) AI Integration.
Provides authenticated, role-aware, fail-closed endpoints for LMS users.
"""

import hashlib
import json
import logging
import urllib.error
import urllib.request
from typing import Any, Dict, Optional, Tuple

from django.conf import settings
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole, UserStatus
from accounts.permissions import IsActiveAccount
from academics.models import Status
from academics.models_xen import XenSchool, XenTrainer, XenLab, XenSession
from core.xen_decoder import decode_model_response

logger = logging.getLogger("security.xen")

# Authoritative Condition A1 System Prompt for PixiuMind 1.4 / Step-700
CONDITION_A1_SYSTEM_PROMPT = """You are PixiuMind 1.4, an expert AI STEM and computer science tutor designed by Pixiu Tech.
You assist K-12 students and teachers with Python programming, physical computing, and computational thinking.
Guidelines:
1. Provide clear, syntactically correct, and pedagogically sound solutions.
2. When asked for code, produce clean Python or Blockly code wrapped in appropriate markdown fences.
3. When asked for hints or explanations, guide the student conceptually without giving away the raw code solution.
4. Support English and Hinglish naturally for bilingual Indian classroom contexts.
5. Be supportive, constructive, and encourage problem-solving."""


class XenBaseView(APIView):
    """Base class for Xen views providing permission verification and upstream proxy utilities."""
    permission_classes = [IsAuthenticated, IsActiveAccount]

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
                return resp_code, json.loads(raw_body)
        except urllib.error.HTTPError as e:
            error_body = {}
            try:
                error_body = json.loads(e.read().decode("utf-8"))
            except Exception:
                pass
            return e.code, error_body or {"error": f"Upstream HTTP {e.code}", "code": "UPSTREAM_ERROR"}
        except urllib.error.URLError as e:
            logger.error(f"Upstream connection failed: {e.reason}")
            return status.HTTP_502_BAD_GATEWAY, {
                "error": "Failed to connect to private PixiuMind inference host.",
                "code": "UPSTREAM_UNREACHABLE",
            }
        except TimeoutError:
            return status.HTTP_504_GATEWAY_TIMEOUT, {
                "error": f"Inference request timed out after {timeout} seconds.",
                "code": "INFERENCE_TIMEOUT",
            }
        except Exception as e:
            logger.error(f"Unexpected error in Xen upstream call: {e}", exc_info=True)
            return status.HTTP_500_INTERNAL_SERVER_ERROR, {
                "error": f"Internal proxy error: {str(e)}",
                "code": "PROXY_ERROR",
            }


class XenHealthView(XenBaseView):
    """
    Check the health and readiness of the upstream inference engine.
    """
    def get(self, request, *args, **kwargs):
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
    Restricted to Admins and Trainers.
    """
    def get(self, request, *args, **kwargs):
        user_role = getattr(request.user, "role", "")
        if user_role not in {UserRole.ADMIN, UserRole.TRAINER}:
            return Response(
                {"error": "Attestation is restricted to Admins and Trainers.", "code": "PERMISSION_DENIED"},
                status=status.HTTP_403_FORBIDDEN,
            )

        code, data = self.call_upstream("/v1/attestation", method="GET", timeout=10)
        return Response(data, status=code)


class XenChatView(XenBaseView):
    """
    Primary chat and tutoring endpoint mediating user interactions with PixiuMind Step-700.
    
    Enforces:
    - Role-based intent verification.
    - Strict server-side prompt construction.
    - Transactional session recording and idempotency.
    - Zero token leakage (<|im_end|> stripped).
    - Incomplete generation policy.
    - Truthful testing assertion policy.
    """
    def post(self, request, *args, **kwargs):
        user = request.user
        role = getattr(user, "role", "")
        prompt = request.data.get("prompt", "")
        intent = request.data.get("intent", "TEACHING").strip().upper()
        history = request.data.get("history", [])
        idempotency_key = request.data.get("idempotency_key", "").strip()

        if not isinstance(prompt, str) or not prompt.strip():
            return Response(
                {"error": "A non-empty prompt is required.", "code": "INVALID_PROMPT"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 1. Intent authorization check
        if role == UserRole.TRAINER:
            # Check trainer profile and A05 qualification
            trainer_profile = getattr(user, "trainer_profile", None)
            xen_trainer = getattr(trainer_profile, "xen_identity", None) if trainer_profile else None
            is_a05 = bool(xen_trainer and xen_trainer.is_a05_qualified)

            if intent == "PERSONAL_LEARNING" and not is_a05:
                return Response(
                    {
                        "error": "PERSONAL_LEARNING intent is restricted to A05-qualified trainers.",
                        "code": "FORBIDDEN_INTENT",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            if intent not in {"TEACHING", "LAB_TEACHING", "PERSONAL_LEARNING"}:
                intent = "TEACHING"

        elif role == UserRole.STUDENT:
            if intent not in {"STUDENT_LEARNING", "HOMEWORK_HELP", "CONCEPT_EXPLANATION", "HINT_ONLY"}:
                intent = "STUDENT_LEARNING"

        elif role == UserRole.ADMIN or role == UserRole.SCHOOL:
            if intent not in {"ADMIN_INSPECTION", "TEACHING_REVIEW"}:
                intent = "TEACHING_REVIEW"

        # 2. Build upstream message payload
        messages = [{"role": "system", "content": CONDITION_A1_SYSTEM_PROMPT}]

        # Append validated history if provided
        if isinstance(history, list):
            for turn in history[-10:]:  # Keep recent 10 turns
                if isinstance(turn, dict) and "role" in turn and "content" in turn:
                    if turn["role"] in {"user", "assistant"}:
                        messages.append({"role": turn["role"], "content": str(turn["content"])})

        messages.append({"role": "user", "content": prompt.strip()})

        # 3. Call upstream inference service
        model_id = getattr(settings, "PIXIUMIND_MODEL_ID", "pixiumind-step-700")
        upstream_payload = {
            "model": model_id,
            "messages": messages,
            "max_tokens": min(int(request.data.get("max_tokens", 1024)), 2048),
            "temperature": float(request.data.get("temperature", 0.1)),
        }

        code, upstream_resp = self.call_upstream(
            "/v1/chat/completions",
            method="POST",
            payload=upstream_payload,
        )

        if code != 200:
            return Response(upstream_resp, status=code)

        # 4. Extract generated choice
        raw_text = ""
        finish_reason = "stop"
        usage = upstream_resp.get("usage", {})

        choices = upstream_resp.get("choices", [])
        if choices and isinstance(choices, list):
            first_choice = choices[0]
            raw_text = first_choice.get("message", {}).get("content", "")
            finish_reason = first_choice.get("finish_reason", "stop")

        # 5. Authoritative response post-processing & sanitization
        decoded = decode_model_response(
            raw_text=raw_text,
            finish_reason=finish_reason,
            actually_executed=False,  # Set False since code was not run in sandbox
            intent=intent,
        )

        # 6. Session recording for idempotency (non-blocking failure tolerance)
        if idempotency_key:
            try:
                XenSession.objects.get_or_create(
                    idempotency_key=idempotency_key,
                    defaults={
                        "user": user,
                        "role": role,
                        "intent": intent,
                        "request_hash": hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
                        "response_summary": decoded["text"][:200],
                        "is_completed": decoded["is_complete"],
                    },
                )
            except Exception as e:
                logger.warning(f"Could not record XenSession: {e}")

        return Response(
            {
                "status": "ok",
                "model": model_id,
                "intent": intent,
                "response": {
                    "text": decoded["text"],
                    "is_complete": decoded["is_complete"],
                    "completion_status": decoded["completion_status"],
                    "syntax_valid": decoded["syntax_valid"],
                    "display_ast_valid": decoded["display_ast_valid"],
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
