"""
Execution Engine for PixiuMind Persistent Serving.
Executes PyTorch generation in a background thread pool to ensure the asyncio
event loop is never blocked, keeping /health/live responsive at all times.

Token Protocol Guarantees:
- EOS Token ID: 151645 (<|im_end|>) strictly preserved from Step-700 frozen reference.
- PAD Token ID: 151643 (<|endoftext|>) kept strictly separate; never merged into EOS.
- Safe-literal input encoding with the pinned chat template
  prevents user input strings from becoming structural ChatML boundaries.
- Token-aware stopping: Slices off the trailing EOS token ID at the token level.
- Clean decoding: Decodes using skip_special_tokens=True without broad string regexes,
  preserving legitimate literal code and documentation examples.
"""

import asyncio
from concurrent.futures import ThreadPoolExecutor
import logging
import re
import time
import uuid
from typing import Any, Dict, List, Optional

logger = logging.getLogger("pixiumind.serving")

# Thread pool dedicated strictly to blocking PyTorch inference
INFERENCE_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="pixiumind_infer")

# Frozen Step-700 / Qwen3 Token Definitions
EOS_TOKEN_ID = 151645  # <|im_end|> (ChatML end of turn)
PAD_TOKEN_ID = 151643  # <|endoftext|> (Padding / Document end)

CONTEXT_WINDOW = 32768
MAX_OUTPUT_TOKENS = 2048


class ContextLengthExceeded(ValueError):
    pass


def encode_chat_prompt(tokenizer, messages):
    """Render the pinned template, then encode literal special tokens as ordinary text."""
    special_tokens = set(tokenizer.all_special_tokens) | {"<think>", "</think>"}
    literals = re.compile("|".join(re.escape(token) for token in sorted(special_tokens, key=len, reverse=True)))
    marker = f"__xen_literal_{uuid.uuid4().hex}_"
    values = []

    def mark(match):
        values.append(match.group())
        return f"{marker}{len(values) - 1}__"

    template_messages = [
        {**message, "content": literals.sub(mark, message["content"])}
        for message in messages
    ]
    rendered = tokenizer.apply_chat_template(
        template_messages, tokenize=False, add_generation_prompt=True,
    )
    segments = re.split(rf"{marker}(\d+)__", rendered)
    token_ids = []
    for index, segment in enumerate(segments):
        if index % 2:
            token_ids.extend(tokenizer.encode(
                values[int(segment)], add_special_tokens=False, split_special_tokens=True,
            ))
        elif segment:
            token_ids.extend(tokenizer.encode(segment, add_special_tokens=False))
    return token_ids


class VisibleText:
    """Remove an initial Qwen reasoning block while retaining literal tags in an answer."""
    def __init__(self):
        self.buffer = ""
        self.hidden = False
        self.answer_started = False

    def feed(self, text, final=False):
        if self.answer_started:
            return text
        self.buffer += text
        if not self.hidden:
            prefix = self.buffer.lstrip()
            if not final and "<think>".startswith(prefix):
                return ""
            if not prefix.startswith("<think>"):
                self.answer_started = True
                result, self.buffer = self.buffer, ""
                return result
            self.hidden = True
            self.buffer = prefix[len("<think>"):]
        _, closed, answer = self.buffer.partition("</think>")
        if closed:
            self.answer_started = True
            self.buffer = ""
            return answer.lstrip("\r\n")
        # Only a partial closing delimiter can affect the next emission.
        self.buffer = self.buffer[-(len("</think>") - 1):]
        return ""


def generation_streamer(tokenizer, emit):
    from transformers import TextStreamer
    visible = VisibleText()

    class WorkerStreamer(TextStreamer):
        def on_finalized_text(self, text, stream_end=False):
            delta = visible.feed(text, final=stream_end)
            if delta:
                emit(delta)

    return WorkerStreamer(tokenizer, skip_prompt=True, skip_special_tokens=True)


def _sync_generate(
    model: Any,
    tokenizer: Any,
    messages: List[Dict[str, str]],
    max_new_tokens: int = 1024,
    temperature: float = 0.1,
    top_p: float = 0.9,
    emit=None,
) -> Dict[str, Any]:
    """Synchronous inference worker executed in background thread."""
    start_time = time.time()
    
    if not 1 <= max_new_tokens <= MAX_OUTPUT_TOKENS:
        raise ContextLengthExceeded("Requested output exceeds the configured output budget.")
    prompt_ids = encode_chat_prompt(tokenizer, messages)
    prompt_tokens = len(prompt_ids)
    if prompt_tokens + max_new_tokens > CONTEXT_WINDOW:
        raise ContextLengthExceeded(
            f"Prompt ({prompt_tokens} tokens) and requested output ({max_new_tokens} tokens) "
            f"exceed the {CONTEXT_WINDOW}-token context window."
        )
    # Generate using strictly approved EOS token ID (151645) and separate PAD token ID (151643)
    import torch
    input_ids = torch.tensor([prompt_ids], device=model.device)
    with torch.no_grad():
        output_ids = model.generate(
            input_ids=input_ids,
            **({"streamer": generation_streamer(tokenizer, emit)} if emit else {}),
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

    decoded_output = VisibleText().feed(decoded_output, final=True)

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
    timeout_seconds: Optional[float] = 450.0,
    emit=None,
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
            emit,
        ),
        timeout=timeout_seconds,
    )
