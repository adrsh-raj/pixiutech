"""
Model Loader and Attestation Module for Step-700 Serving.
"""

import hashlib
import logging
import os
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger("pixiumind.serving")

def compute_sha256(file_path: str) -> str:
    """Compute SHA-256 checksum of a file in chunks."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(8 * 1024 * 1024):
            h.update(chunk)
    return h.hexdigest()

class ModelHolder:
    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.is_ready = False
        self.attestation_data: Dict[str, Any] = {}

    def verify_provenance(self, base_path: str, adapter_path: str, expected_adapter_sha256: str) -> bool:
        """Verify model files and adapter SHA-256 before loading."""
        adapter_file = os.path.join(adapter_path, "adapter_model.safetensors")
        if not os.path.exists(adapter_file):
            logger.error(f"Adapter file not found at {adapter_file}")
            return False

        actual_sha = compute_sha256(adapter_file)
        if actual_sha != expected_adapter_sha256:
            logger.error(f"Adapter SHA-256 mismatch! Expected {expected_adapter_sha256}, got {actual_sha}")
            return False

        self.attestation_data = {
            "base_model": "Qwen/Qwen3-14B",
            "base_revision": "40c069824f4251a91eefaf281ebe4c544efd3e18",
            "adapter": "PixiuMind-1.4-D14-Step-700",
            "adapter_sha256": actual_sha,
            "adapter_path": adapter_path,
            "runtime_versions": {
                "python": "3.13.16",
                "torch": "2.6.0+cu124",
                "transformers": "4.49.0",
                "peft": "0.14.0",
                "accelerate": "1.4.0",
                "bitsandbytes": "0.50.2",
                "cuda": "12.4",
            },
        }
        return True

    def load_model(self, base_path: str, adapter_path: str, use_4bit: bool = True, device_map: str = "auto") -> bool:
        """Load Qwen3-14B base + Step-700 PEFT LoRA adapter."""
        try:
            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
            from peft import PeftModel

            logger.info("Initializing AutoTokenizer...")
            self.tokenizer = AutoTokenizer.from_pretrained(base_path, trust_remote_code=True)
            if self.tokenizer.pad_token_id is None:
                self.tokenizer.pad_token_id = self.tokenizer.eos_token_id

            logger.info("Configuring quantization...")
            bnb_config = None
            if use_4bit and torch.cuda.is_available():
                bnb_config = BitsAndBytesConfig(
                    load_in_4bit=True,
                    bnb_4bit_quant_type="nf4",
                    bnb_4bit_use_double_quant=True,
                    bnb_4bit_compute_dtype=torch.float16,
                )

            logger.info("Loading base model...")
            base_model = AutoModelForCausalLM.from_pretrained(
                base_path,
                quantization_config=bnb_config,
                device_map=device_map if torch.cuda.is_available() else "cpu",
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                trust_remote_code=True,
                low_cpu_mem_usage=True,
            )

            logger.info("Applying Step-700 LoRA adapter...")
            self.model = PeftModel.from_pretrained(base_model, adapter_path)
            self.model.eval()
            self.is_ready = True
            logger.info("PixiuMind Step-700 persistent loader ready!")
            return True

        except Exception as e:
            logger.error(f"Failed to load model into memory: {e}", exc_info=True)
            self.is_ready = False
            return False

model_holder = ModelHolder()
