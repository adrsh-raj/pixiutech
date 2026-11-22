"""
FastAPI Server for PixiuMind Persistent Inference Service.
"""

import asyncio
import hmac
import logging
import time
import uuid
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Header, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from config import config
from engine import async_generate
from loader import model_holder

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("pixiumind.server")

app = FastAPI(
    title="PixiuMind Persistent Serving API",
    version="1.4.0",
    description="Private backend-only serving interface for PixiuMind Step-700",
    docs_url=None,  # No public API documentation exposed
    redoc_url=None,
)

# Concurrency semaphore to prevent GPU VRAM overload (initialized lazily to avoid loop binding issues)
_concurrency_semaphore: Optional[asyncio.Semaphore] = None

def get_concurrency_semaphore() -> asyncio.Semaphore:
    global _concurrency_semaphore
    if _concurrency_semaphore is None:
        _concurrency_semaphore = asyncio.Semaphore(config.max_concurrency)
    return _concurrency_semaphore


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: str = Field(default="pixiumind-step-700")
    messages: List[ChatMessage]
    max_tokens: Optional[int] = Field(default=1024, ge=1, le=4096)
    temperature: Optional[float] = Field(default=0.1, ge=0.0, le=2.0)
    top_p: Optional[float] = Field(default=0.9, ge=0.0, le=1.0)
    stream: Optional[bool] = Field(default=False)


def verify_authentication(auth_header: Optional[str] = Header(None, alias="Authorization"), x_api_key: Optional[str] = Header(None, alias="X-API-Key")):
    """Verify incoming request authentication token using constant-time comparison."""
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    elif x_api_key:
        token = x_api_key.strip()

    if not token or not hmac.compare_digest(token, config.api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "Unauthorized: Invalid or missing API key", "code": "UNAUTHORIZED"},
        )


@app.get("/health/live")
async def health_live():
    """
    Ultra-fast non-blocking liveness probe.
    Must always respond immediately (<50ms) even under heavy inference load.
    """
    return JSONResponse(
        content={"status": "live", "service": "pixiumind-step700", "timestamp": time.time()},
        status_code=status.HTTP_200_OK,
    )


@app.get("/health/ready")
async def health_ready():
    """
    Readiness probe verifying that model and adapter weights are loaded in memory.
    """
    if not model_holder.is_ready:
        return JSONResponse(
            content={"status": "not_ready", "error": "Model weights are not currently loaded in memory."},
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return JSONResponse(
        content={"status": "ready", "model": "PixiuMind-1.4-D14-Step-700", "timestamp": time.time()},
        status_code=status.HTTP_200_OK,
    )


@app.get("/v1/attestation")
async def get_attestation(request: Request):
    """
    Identity attestation endpoint verifying model provenance, adapter hash, and runtime versions.
    """
    verify_authentication(
        request.headers.get("Authorization"),
        request.headers.get("X-API-Key"),
    )
    return JSONResponse(
        content={
            "status": "verified",
            "attestation": model_holder.attestation_data,
            "is_ready": model_holder.is_ready,
        },
        status_code=status.HTTP_200_OK,
    )


async def handle_chat_completion(req: ChatCompletionRequest, request: Request):
    """Shared completion handler for /v1/chat/completions and alias /chat/completions."""
    verify_authentication(
        request.headers.get("Authorization"),
        request.headers.get("X-API-Key"),
    )

    # Validate model ID
    if req.model.lower() not in [m.lower() for m in config.allowed_models]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": f"Invalid model '{req.model}'. Allowed models: {config.allowed_models}",
                "code": "INVALID_MODEL",
            },
        )

    # Check model readiness
    if not model_holder.is_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": "Inference service is currently initializing or not ready.", "code": "MODEL_NOT_READY"},
        )

    # Acquire concurrency slot with queue timeout
    semaphore = get_concurrency_semaphore()
    try:
        await asyncio.wait_for(semaphore.acquire(), timeout=config.queue_timeout_seconds)
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "Inference server concurrency queue is saturated.", "code": "SERVER_OVERLOADED"},
        )

    try:
        messages_dicts = [{"role": m.role, "content": m.content} for m in req.messages]
        result = await async_generate(
            model_holder.model,
            model_holder.tokenizer,
            messages_dicts,
            max_new_tokens=req.max_tokens or 1024,
            temperature=req.temperature or 0.1,
            top_p=req.top_p or 0.9,
            timeout_seconds=config.inference_timeout_seconds,
        )

        response_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
        return JSONResponse(
            content={
                "id": response_id,
                "object": "chat.completion",
                "created": int(time.time()),
                "model": req.model,
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": result["text"],
                        },
                        "finish_reason": result["finish_reason"],
                    }
                ],
                "usage": {
                    "prompt_tokens": result["prompt_tokens"],
                    "completion_tokens": result["completion_tokens"],
                    "total_tokens": result["total_tokens"],
                },
                "latency_seconds": result["latency_seconds"],
                "throughput_tok_s": result["throughput_tok_s"],
            },
            status_code=status.HTTP_200_OK,
        )

    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={"error": "Inference generation timed out on GPU.", "code": "INFERENCE_TIMEOUT"},
        )
    except Exception as e:
        logger.error(f"Inference generation error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": f"Internal inference error: {str(e)}", "code": "INFERENCE_FAILED"},
        )
    finally:
        semaphore.release()


@app.post("/v1/chat/completions")
async def chat_completions(req: ChatCompletionRequest, request: Request):
    return await handle_chat_completion(req, request)


@app.post("/chat/completions")
async def chat_completions_alias(req: ChatCompletionRequest, request: Request):
    """OpenAI standard endpoint alias."""
    return await handle_chat_completion(req, request)
