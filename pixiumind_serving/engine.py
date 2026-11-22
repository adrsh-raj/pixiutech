"""
Execution Engine for PixiuMind Persistent Serving.
Executes PyTorch generation in a background thread pool to ensure the asyncio
event loop is never blocked, keeping /health/live responsive at all times.
"""

import asyncio
from concurrent.futures import ThreadPoolExecutor
import logging
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger("pixiumind.serving")

# Thread pool dedicated strictly to blocking PyTorch inference
# Keeping max_workers bounded to GPU concurrency capability
INFERENCE_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="pixiumind_infer")

# Stop token IDs for Qwen3 / PixiuMind
STOP_TOKEN_IDS = [151645, 151643]  # <|im_end|>, <|endoftext|>

def _sync_generate(
    model: Any,
    tokenizer: Any,
    messages: List[Dict[str, str]],
    max_new_tokens: int = 1024,
    temperature: float = 0.1,
    top_p: float = 0.9,
) -> Dict[str, Any]:
    """Synchronous inference worker executed in background thread."""
    start_time = time.time()
    
    # Format messages using Qwen chat template
    text_prompt = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )
    
    inputs = tokenizer([text_prompt], return_tensors="pt")
    input_ids = inputs.input_ids
    if hasattr(model, "device"):
        input_ids = input_ids.to(model.device)

    prompt_tokens = input_ids.shape[1]

    # Generate
    import torch
    with torch.no_grad():
        output_ids = model.generate(
            input_ids=input_ids,
            max_new_tokens=max_new_tokens,
            temperature=temperature if temperature > 0 else None,
            do_sample=temperature > 0,
            top_p=top_p if temperature > 0 else None,
            eos_token_id=STOP_TOKEN_IDS,
            pad_token_id=tokenizer.pad_token_id,
        )

    # Slice out generated tokens (excluding prompt)
    generated_tokens = output_ids[0][prompt_tokens:]
    completion_tokens = len(generated_tokens)
    
    # Determine finish reason
    last_token_id = generated_tokens[-1].item() if completion_tokens > 0 else None
    if last_token_id in STOP_TOKEN_IDS:
        finish_reason = "stop"
    elif completion_tokens >= max_new_tokens:
        finish_reason = "length"
    else:
        finish_reason = "stop"

    # Decode with skip_special_tokens=True to prevent <|im_end|> leakage
    raw_output = tokenizer.decode(generated_tokens, skip_special_tokens=True)
    
    # Defensive strip of trailing special tokens
    cleaned_output = raw_output.replace("<|im_end|>", "").replace("<|endoftext|>", "").strip()

    latency_s = time.time() - start_time

    return {
        "text": cleaned_output,
        "finish_reason": finish_reason,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": prompt_tokens + completion_tokens,
        "latency_seconds": round(latency_s, 3),
        "throughput_tok_s": round(completion_tokens / latency_s, 2) if latency_s > 0 else 0.0,
    }


async def async_generate(
    model: Any,
    tokenizer: Any,
    messages: List[Dict[str, str]],
    max_new_tokens: int = 1024,
    temperature: float = 0.1,
    top_p: float = 0.9,
    timeout_seconds: float = 450.0,
) -> Dict[str, Any]:
    """
    Non-blocking async wrapper that offloads PyTorch generation to INFERENCE_EXECUTOR.
    Leaves the asyncio event loop completely free to handle /health/live requests.
    """
    loop = asyncio.get_running_loop()
    
    return await asyncio.wait_for(
        loop.run_in_executor(
            INFERENCE_EXECUTOR,
            _sync_generate,
            model,
            tokenizer,
            messages,
            max_new_tokens,
            temperature,
            top_p,
        ),
        timeout=timeout_seconds,
    )
