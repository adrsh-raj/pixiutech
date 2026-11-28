"""
FastAPI Server for PixiuMind Persistent Inference Service.
"""

import asyncio
from contextlib import asynccontextmanager
import hmac
import json
import logging
import time
import uuid
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from config import config
from engine import MAX_OUTPUT_TOKENS, ContextLengthExceeded, async_generate
from loader import model_holder

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("pixiumind.server")

FROZEN_BASE_REVISION = "40c069824f4251a91eefaf281ebe4c544efd3e18"


def initialize_model():
    model_holder.reset()
    try:
        if config.base_revision != FROZEN_BASE_REVISION:
            raise ValueError("Configured base model revision is not Step-700.")
        if model_holder.verify_provenance(
            config.base_model_path,
            config.adapter_path,
            prompt_path=config.a1_prompt_path,
        ):
            model_holder.load_model(
                config.base_model_path,
                config.adapter_path,
                use_4bit=config.use_4bit,
                device_map=config.device_map,
            )
    except (OSError, ValueError):
        logger.exception("Model provenance inputs could not be read")
        model_holder.reset()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _concurrency_semaphore
    _concurrency_semaphore = None
    model_holder.reset()
    initialization = asyncio.create_task(asyncio.to_thread(initialize_model))
    try:
        yield
    finally:
        try:
            await initialization
        finally:
            model_holder.reset()
        _concurrency_semaphore = None


app = FastAPI(
    lifespan=lifespan,
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
    max_tokens: Optional[int] = Field(default=1024, ge=1, le=MAX_OUTPUT_TOKENS, strict=True)
    temperature: Optional[float] = Field(default=0.1, ge=0.0, le=2.0, strict=True)
    top_p: Optional[float] = Field(default=0.9, ge=0.0, le=1.0, strict=True)
    stream: Optional[bool] = Field(default=False)


def verify_authentication(auth_header: Optional[str] = Header(None, alias="Authorization"), x_api_key: Optional[str] = Header(None, alias="X-API-Key")):
    """Verify incoming request authentication token using constant-time comparison."""
    if not config.api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": "Inference service API key is unconfigured.", "code": "API_KEY_UNCONFIGURED"},
        )
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    elif x_api_key:
        token = x_api_key.strip()

    if not token or not hmac.compare_digest(token.encode(), config.api_key.encode()):
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
        content={"status": "live"},
        status_code=status.HTTP_200_OK,
    )


@app.get("/health/ready", dependencies=[Depends(verify_authentication)])
async def health_ready():
    """
    Readiness probe verifying that model and adapter weights are loaded in memory.
    """
    if not model_holder.is_ready or not model_holder.is_verified:
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
    if not model_holder.is_ready or not getattr(model_holder, "is_verified", False) or not model_holder.attestation_data.get("is_verified"):
        return JSONResponse(
            content={"status": "not_verified", "error": "Model weights are not verified or not loaded in memory.", "code": "NOT_VERIFIED"},
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return JSONResponse(
        content={
            "status": "verified",
            "attestation": {
                key: model_holder.attestation_data[key]
                for key in (
                    "base_model", "base_revision", "base_shards_verified", "base_metadata_verified",
                    "adapter", "adapter_sha256", "adapter_config_status", "a1_prompt_sha256",
                    "runtime_versions",
                )
                if key in model_holder.attestation_data
            },
            "is_ready": model_holder.is_ready,
        },
        status_code=status.HTTP_200_OK,
    )


async def handle_chat_completion(req: ChatCompletionRequest, request: Request, emit=None):
    """Shared completion handler for /v1/chat/completions and alias /chat/completions."""
    verify_authentication(
        request.headers.get("Authorization"),
        request.headers.get("X-API-Key"),
    )

    if req.stream:
        raise HTTPException(
            status_code=400,
            detail={"code": "STREAMING_UNSUPPORTED", "error": "Streaming is unavailable in Xen v0.1."},
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
    if not model_holder.is_ready or not model_holder.is_verified:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": "Inference service is currently initializing or not ready.", "code": "MODEL_NOT_READY"},
        )

    # P1.2 Context & history validation
    if len(req.messages) > 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": f"Message history exceeds limit of 20 turns (got {len(req.messages)})", "code": "TOO_MANY_MESSAGES"},
        )

    allowed_roles = {"system", "user", "assistant"}
    aggregate_chars = 0
    for i, m in enumerate(req.messages):
        if m.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": f"Invalid message role '{m.role}' at index {i}", "code": "INVALID_ROLE"},
            )
        if len(m.content) > 4000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": f"Message at index {i} exceeds 4000 characters (got {len(m.content)})", "code": "MESSAGE_TOO_LARGE"},
            )
        aggregate_chars += len(m.content)

    if aggregate_chars > 16000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": f"Aggregate prompt exceeds 16000 characters (got {aggregate_chars})", "code": "AGGREGATE_PROMPT_TOO_LARGE"},
        )

    active_system_prompt = model_holder.composite_system_prompt or model_holder.system_prompt
    messages_dicts = [{"role": m.role, "content": m.content} for m in req.messages]
    if messages_dicts and messages_dicts[0]["role"] == "system":
        supplied_prompt = messages_dicts.pop(0)["content"]
        legacy_prompt = getattr(model_holder, "legacy_composite_system_prompt", None)
        if legacy_prompt and supplied_prompt == legacy_prompt:
            active_system_prompt = model_holder.composite_system_prompt or model_holder.system_prompt
        elif (
            supplied_prompt != model_holder.composite_system_prompt
            and supplied_prompt != model_holder.system_prompt
        ):
            raise HTTPException(status_code=400, detail={"code": "INVALID_SYSTEM_PROMPT"})
        else:
            active_system_prompt = supplied_prompt
    if any(message["role"] == "system" for message in messages_dicts):
        raise HTTPException(status_code=400, detail={"code": "INVALID_SYSTEM_PROMPT"})
    for message in messages_dicts:
        content = message["content"].replace("\x00", "")
        while True:
            cleaned = content
            for delimiter in ("<|im_start|>", "<|im_end|>", "<|endoftext|>"):
                cleaned = cleaned.replace(delimiter, "")
            if cleaned == content:
                break
            content = cleaned
        message["content"] = content.strip()

    if not messages_dicts or messages_dicts[-1]["role"] != "user" or not messages_dicts[-1]["content"]:
        raise HTTPException(status_code=400, detail={"code": "INVALID_MESSAGE_HISTORY"})
    if active_system_prompt is not None:
        messages_dicts.insert(0, {"role": "system", "content": active_system_prompt})

    # Acquire concurrency slot with queue timeout
    semaphore = get_concurrency_semaphore()
    try:
        await asyncio.wait_for(semaphore.acquire(), timeout=config.queue_timeout_seconds)
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "Inference server concurrency queue is saturated.", "code": "SERVER_OVERLOADED"},
        )

    generation = None
    try:
        generation = asyncio.create_task(async_generate(
            model_holder.model,
            model_holder.tokenizer,
            messages_dicts,
            max_new_tokens=req.max_tokens if req.max_tokens is not None else 1024,
            temperature=req.temperature if req.temperature is not None else 0.1,
            top_p=req.top_p if req.top_p is not None else 0.9,
            timeout_seconds=None,
            **({"emit": emit} if emit else {}),
        ))
        result = await asyncio.wait_for(
            asyncio.shield(generation), timeout=config.inference_timeout_seconds,
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

    except ContextLengthExceeded as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": str(exc), "code": "CONTEXT_LENGTH_EXCEEDED"},
        ) from exc
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={"error": "Inference generation timed out on GPU.", "code": "INFERENCE_TIMEOUT"},
        )
    except Exception as e:
        logger.error(f"Inference generation error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Internal inference error.", "code": "INFERENCE_FAILED"},
        )
    finally:
        if generation is None or generation.done():
            semaphore.release()
        else:
            # PyTorch work can outlive its HTTP request. Hold the slot until it actually exits.
            def release_slot(task):
                semaphore.release()
                if not task.cancelled():
                    task.exception()

            generation.add_done_callback(release_slot)


@app.post("/v1/chat/completions")
async def chat_completions(req: ChatCompletionRequest, request: Request):
    return await handle_chat_completion(req, request)


@app.post("/chat/completions")
async def chat_completions_alias(req: ChatCompletionRequest, request: Request):
    """OpenAI standard endpoint alias."""
    return await handle_chat_completion(req, request)

@app.post("/internal/worker/generation")
async def worker_generation(req: ChatCompletionRequest, request: Request):
    """Private NDJSON feed for the authenticated outbound worker."""
    verify_authentication(request.headers.get("Authorization"), request.headers.get("X-API-Key"))
    loop = asyncio.get_running_loop()
    events = asyncio.Queue()

    async def generate():
        try:
            response = await handle_chat_completion(req, request, emit=lambda delta: loop.call_soon_threadsafe(
                events.put_nowait, {"delta": delta}
            ))
            events.put_nowait({"completion": json.loads(response.body)})
        except HTTPException as exc:
            events.put_nowait({"error": exc.detail.get("code", "INFERENCE_FAILED") if isinstance(exc.detail, dict) else "INFERENCE_FAILED"})

    async def stream():
        task = asyncio.create_task(generate())
        try:
            while True:
                event = await events.get()
                yield json.dumps(event, ensure_ascii=False) + "\n"
                if "delta" not in event:
                    break
        finally:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)

    return StreamingResponse(stream(), media_type="application/x-ndjson")
