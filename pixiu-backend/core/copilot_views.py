import json
import logging
import urllib.error
import urllib.request
from django.conf import settings
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.permissions import IsActiveAccount

logger = logging.getLogger("security.auth")

DEFAULT_SYSTEM_PROMPT = """You are PixiuMind 1.0, the specialized AI tutor and STEM circuit copilot for Pixiu Tech.
Generate complete, valid, schema-compliant Blockly XML workspaces wrapped in ```xml ... ``` blocks for Arduino Uno.
Ensure correct block types, required fields, connections, and pin assignments.
Explain the pedagogical logic clearly."""


class CopilotProposalProxyView(APIView):
    """
    Secure backend proxy for PixiuMind GPU inference.
    
    Protects private GPU endpoints and authentication keys by mediating
    all frontend copilot requests through the authenticated Django server.
    Ensures zero client-side leakage of infrastructure credentials.
    """
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def post(self, request, *args, **kwargs):
        task = request.data.get("task", "")
        if not isinstance(task, str) or not task.strip():
            return Response(
                {"error": "A non-empty task description is required.", "code": "INVALID_TASK"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        endpoint_url = getattr(settings, "PIXIUMIND_ENDPOINT_URL", "").strip()
        if not endpoint_url:
            return Response(
                {
                    "error": "PixiuMind inference endpoint is not configured in backend environment.",
                    "code": "PROVIDER_UNCONFIGURED",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        api_key = getattr(settings, "PIXIUMIND_API_KEY", "").strip()
        model_id = getattr(settings, "PIXIUMIND_MODEL_ID", "pixiumind-14b-checkpoint-400").strip()
        timeout = getattr(settings, "PIXIUMIND_TIMEOUT_SECONDS", 30)

        context = request.data.get("context", {})
        workspace_xml = request.data.get("workspace_xml", "")
        max_tokens = int(request.data.get("max_tokens", 1024))
        temperature = float(request.data.get("temperature", 0.1))

        # Build prompt messages
        messages = [
            {"role": "system", "content": DEFAULT_SYSTEM_PROMPT},
        ]
        user_prompt = f"Task: {task.strip()}"
        if workspace_xml:
            user_prompt += f"\n\nCurrent Workspace XML:\n{workspace_xml}"
        if context and isinstance(context, dict):
            board = context.get("board", "arduino-uno")
            user_prompt = f"[Target Board: {board}]\n" + user_prompt

        messages.append({"role": "user", "content": user_prompt})

        payload = {
            "model": model_id,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        # Normalize upstream URL
        chat_url = f"{endpoint_url.rstrip('/')}/v1/chat/completions"
        req = urllib.request.Request(
            chat_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        if api_key:
            req.add_header("Authorization", f"Bearer {api_key}")

        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                status_code = resp.getcode()
                raw_body = resp.read().decode("utf-8")
                upstream_data = json.loads(raw_body)
                
                # Extract assistant reply
                proposal_text = ""
                if "choices" in upstream_data and len(upstream_data["choices"]) > 0:
                    first_choice = upstream_data["choices"][0]
                    if "message" in first_choice and "content" in first_choice["message"]:
                        proposal_text = first_choice["message"]["content"]
                    elif "text" in first_choice:
                        proposal_text = first_choice["text"]

                return Response(
                    {
                        "status": "ok",
                        "proposal": proposal_text,
                        "model": model_id,
                        "raw_response": upstream_data,
                    },
                    status=status.HTTP_200_OK,
                )
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8", errors="replace")
            logger.warning(f"PixiuMind upstream HTTP {e.code}: {error_body}")
            return Response(
                {
                    "error": f"Upstream GPU inference server returned error: {e.code}",
                    "code": "UPSTREAM_ERROR",
                    "details": error_body,
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except urllib.error.URLError as e:
            logger.warning(f"PixiuMind upstream unreachable: {e.reason}")
            return Response(
                {
                    "error": f"Failed to reach GPU inference server: {str(e.reason)}",
                    "code": "PROVIDER_UNREACHABLE",
                },
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )
        except Exception as e:
            logger.exception("Unexpected error in CopilotProposalProxyView")
            return Response(
                {
                    "error": f"Internal proxy error: {str(e)}",
                    "code": "INTERNAL_PROXY_ERROR",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
