"""
Execution Engine for PixiuMind Persistent Serving.
Executes PyTorch generation in a background thread pool to ensure the asyncio
event loop is never blocked, keeping /health/live responsive at all times.

Token Protocol Guarantees:
- EOS Token ID: 151645 (<|im_end|>) strictly preserved from Step-700 frozen reference.
- PAD Token ID: 151643 (<|endoftext|>) kept strictly separate; never merged into EOS.
- Safe-literal input encoding: apply_chat_template(tokenize=True, sanitize_control_tokens=True)
  prevents user input strings from becoming structural ChatML boundaries.
- Token-aware stopping: Slices off the trailing EOS token ID at the token level.
- Clean decoding: Decodes using skip_special_tokens=True without broad string regexes,
  preserving legitimate literal code and documentation examples.
"""

import asyncio
from concurrent.futures import ThreadPoolExecutor
import logging
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger("pixiumind.serving")

# Thread pool dedicated strictly to blocking PyTorch inference
INFERENCE_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="pixiumind_infer")

# Frozen Step-700 / Qwen3 Token Definitions
EOS_TOKEN_ID = 151645  # <|im_end|> (ChatML end of turn)
PAD_TOKEN_ID = 151643  # <|endoftext|> (Padding / Document end)

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
    
    # Safe-literal tokenization: encodes user text safely without allowing
    # literal strings (like '<|im_end|>') to become control tokens
    encoded = tokenizer.apply_chat_template(
        messages,
        tokenize=True,
        add_generation_prompt=True,
        sanitize_control_tokens=True,
        return_tensors="pt",
        return_dict=True,
    )
    
    input_ids = encoded["input_ids"]
    if hasattr(model, "device"):
        input_ids = input_ids.to(model.device)

    prompt_tokens = input_ids.shape[1]

    # Generate using strictly approved EOS token ID (151645) and separate PAD token ID (151643)
    import torch
    with torch.no_grad():
        output_ids = model.generate(
            input_ids=input_ids,
            max_new_tokens=max_new_tokens,
            temperature=temperature if temperature > 0 else None,
            do_sample=temperature > 0,
            top_p=top_p if temperature > 0 else None,
            eos_token_id=EOS_TOKEN_ID,
            pad_token_id=PAD_TOKEN_ID,
        )

    # Slice out generated tokens (excluding prompt)
    generated_tokens = output_ids[0][prompt_tokens:]
    completion_tokens = len(generated_tokens)
    
    # Token-aware stopping check
    if completion_tokens > 0 and generated_tokens[-1].item() == EOS_TOKEN_ID:
        finish_reason = "stop"
        content_tokens = generated_tokens[:-1]  # Slice off structural EOS token
    elif completion_tokens >= max_new_tokens:
        finish_reason = "length"
        content_tokens = generated_tokens
    else:
        finish_reason = "stop"
        content_tokens = generated_tokens

    # Decode at the token boundary with skip_special_tokens=True
    # Preserves legitimate literal text (e.g. print("<|im_end|>")) while omitting protocol tokens
    decoded_output = tokenizer.decode(content_tokens, skip_special_tokens=True)

    latency_s = time.time() - start_time

    return {
        "text": decoded_output,
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
