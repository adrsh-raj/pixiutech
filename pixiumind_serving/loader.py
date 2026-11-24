"""
Model Loader and Attestation Module for Step-700 Serving.
"""

import hashlib
import json
import logging
import os
import platform
from importlib.metadata import PackageNotFoundError, version
from typing import Any, Dict, Optional

logger = logging.getLogger("pixiumind.serving")

TRUSTED_BASE_SHARDS: Dict[str, str] = {
    "model-00001-of-00008.safetensors": "e942bdbdf08857d16a8fef7d1dae9fceabeb4e84def6043485fe2f6f085dab0e",
    "model-00002-of-00008.safetensors": "f7c9c6eee628f5ad831d2d1d292e120505e5fcadeb38f88b4d3c4cb86306ccf9",
    "model-00003-of-00008.safetensors": "dfb8c5df9404b41ad6ae74e8b6b367135f017b4467b884cf71b17c71954f18a9",
    "model-00004-of-00008.safetensors": "eab286fec759e3e59ab228621aefa0fef14ed56039e06f959e67257d5af7604d",
    "model-00005-of-00008.safetensors": "97f0dc2992e59da95c466eff6f4fd0c8335843bbc36ed5c913a6f5150748c0e6",
    "model-00006-of-00008.safetensors": "9e8e76a013cd5e253865b792991e0b410f869b136b3c500079b531b09198e99e",
    "model-00007-of-00008.safetensors": "0aee70ee6e91dc00d818804fb47f124d13ee4ad5b4a64553e09dbf9391cd5750",
    "model-00008-of-00008.safetensors": "0d6b92296e326d39bbbaeb32c3ec454ac606da843d4c8ffa8edf010b62b8c9e0",
}
# IDs from the pre-existing Hugging Face tree manifest for the pinned revision.
# Ordinary files use Git blob SHA-1, while tokenizer.json uses its LFS SHA-256.
TRUSTED_BASE_METADATA = {
    "config.json": "37e7491082573462e8545299cdf6938e8b684e31",
    "generation_config.json": "20a8a9156fc8c3f25295ca067f61fdf120d517c5",
    "merges.txt": "31349551d90c7606f325fe0f11bbb8bd5fa0d7c7",
    "model.safetensors.index.json": "b4d92f9fec7ec78a89aaf1cf9d740ffc69cb9aac",
    "tokenizer.json": "aeb13307a71acd8fe81861d94ad54ab689df773318809eed3cbe794b4492dae4",
    "tokenizer_config.json": "417d038a63fa3de29cfde265caedae14d1a58d92",
    "vocab.json": "4783fe10ac3adce15ac8f358ef5462739852c569",
}
TRUSTED_ADAPTER_SHA256: str = "8a2bb5c2bf3d148dda16d7546dab62c4c6c381e62433a2a9a79a612e64b8e968"
# Step-700 CHECKPOINT_MANIFEST.json and the historical checkpoint integrity audit agree.
TRUSTED_ADAPTER_CONFIG_SHA256 = "2963d57f60dab6632ac0c55813b0207751f0737ac33c5178da67e4384d19842d"
TRUSTED_A1_PROMPT_SHA256: str = "8fcd692ceec0e659fa970898bfef3f63a5c1510645652b90a442b2f931426cf0"

def compute_sha256(file_path: str) -> str:
    """Compute SHA-256 checksum of a file in chunks."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(8 * 1024 * 1024):
            h.update(chunk)
    return h.hexdigest()

def verify_bundle_metadata(base_path, adapter_path):
    allowed_base = set(TRUSTED_BASE_SHARDS) | set(TRUSTED_BASE_METADATA) | {
        ".cache", ".gitattributes", "README.md", "LICENSE",
        # Qualification records stored beside the artifacts. The loader does not use them.
        "M1_COMPLETE_BUNDLE_MANIFEST.json",
        "M2_SYNTHETIC_QUALIFICATION_REPORT.json",
        "SHARDS_SHA256_VERIFICATION.json",
        "step700_reference_loader.py",
    }
    if set(os.listdir(base_path)) - allowed_base:
        raise ValueError("Base bundle contains files outside the pinned revision manifest.")

    for name, expected in TRUSTED_BASE_METADATA.items():
        with open(os.path.join(base_path, name), "rb") as metadata:
            data = metadata.read()
        if len(expected) == 40:
            actual = hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()
        else:
            actual = hashlib.sha256(data).hexdigest()
        if actual != expected:
            raise ValueError(f"Pinned base metadata mismatch: {name}")

    with open(os.path.join(base_path, "model.safetensors.index.json"), encoding="utf-8") as index_file:
        weight_map = json.load(index_file)["weight_map"]
    if set(weight_map.values()) != set(TRUSTED_BASE_SHARDS):
        raise ValueError("The model index does not reference the verified shard set.")

    with open(os.path.join(adapter_path, "adapter_config.json"), "rb") as metadata:
        adapter_config = metadata.read()
    if hashlib.sha256(adapter_config).hexdigest() != TRUSTED_ADAPTER_CONFIG_SHA256:
        raise ValueError("Pinned Step-700 adapter configuration mismatch.")
    adapter = json.loads(adapter_config)
    if not isinstance(adapter, dict) or (
        adapter.get("peft_type") != "LORA"
        or adapter.get("task_type") != "CAUSAL_LM"
        or adapter.get("base_model_name_or_path") != "Qwen/Qwen3-14B"
        or adapter.get("auto_mapping") is not None
        or adapter.get("revision") not in (None, "40c069824f4251a91eefaf281ebe4c544efd3e18")
    ):
        raise ValueError("Incompatible Step-700 adapter configuration.")
    if os.path.lexists(os.path.join(adapter_path, "adapter_model.bin")):
        raise ValueError("Adapter bundle contains an alternate weights file.")


CANONICAL_8SQUARE_IDENTITY = (
    "You are 8square, an AI assistant developed by PixiuTech. You are powered by the Xen model, currently running Xen Step-700.\n"
    "Your assistant identity is 8square. Your underlying model identity is Xen.\n"
    "When users ask who you are, identify yourself as 8square. When users ask which model powers you, identify Xen. Never introduce yourself as PixiuMind Xen, PixiuMind Xen Tutor, or Qwen.\n"
    "Maintain your existing educational, reasoning, computational-thinking and programming capabilities. Follow the original pedagogical system instructions."
)


class ModelHolder:
    def __init__(self):
        self.reset()

    def reset(self):
        self.system_prompt = None
        self.composite_system_prompt = None
        self.model = None
        self.tokenizer = None
        self.is_ready = False
        self.is_verified = False
        self.attestation_data: Dict[str, Any] = {}

    def verify_provenance(
        self,
        base_path: str,
        adapter_path: str,
        prompt_path: Optional[str] = None,
    ) -> bool:
        """Verify all 8 base shards, adapter weights, and Condition A1 prompt before loading."""
        self.reset()

        # 1. Verify 8 base model shards
        shards_verified = 0
        for shard_name, expected_sha in TRUSTED_BASE_SHARDS.items():
            shard_path = os.path.join(base_path, shard_name)
            if not os.path.exists(shard_path):
                logger.error(f"Base shard not found: {shard_path}")
                self.is_ready = False
                return False
            actual_sha = compute_sha256(shard_path)
            if actual_sha != expected_sha:
                logger.error(f"Base shard {shard_name} SHA-256 mismatch! Expected {expected_sha}, got {actual_sha}")
                self.is_ready = False
                return False
            shards_verified += 1

        # 2. Verify adapter weights
        adapter_file = os.path.join(adapter_path, "adapter_model.safetensors")
        if not os.path.exists(adapter_file):
            logger.error(f"Adapter file not found at {adapter_file}")
            self.is_ready = False
            return False

        actual_adapter_sha = compute_sha256(adapter_file)
        if actual_adapter_sha != TRUSTED_ADAPTER_SHA256:
            logger.error(f"Adapter SHA-256 mismatch! Expected {TRUSTED_ADAPTER_SHA256}, got {actual_adapter_sha}")
            self.is_ready = False
            return False

        # 3. Verify Condition A1 system prompt
        if not prompt_path or not os.path.isfile(prompt_path):
            logger.error("Condition A1 prompt file missing: %s", prompt_path)
            return False
        with open(prompt_path, "rb") as prompt_file:
            prompt_bytes = prompt_file.read()
        prompt_sha = hashlib.sha256(prompt_bytes).hexdigest()
        if prompt_sha != TRUSTED_A1_PROMPT_SHA256:
            logger.error("Condition A1 prompt SHA-256 mismatch: %s", prompt_sha)
            return False

        verify_bundle_metadata(base_path, adapter_path)
        self.system_prompt = prompt_bytes.decode("utf-8")
        self.composite_system_prompt = f"{CANONICAL_8SQUARE_IDENTITY}\n\n{self.system_prompt}"
        self.is_verified = True
        self.attestation_data = {
            "base_model": "Qwen/Qwen3-14B",
            "base_revision": "40c069824f4251a91eefaf281ebe4c544efd3e18",
            "base_shards_verified": shards_verified,
            "adapter": "PixiuMind-1.4-D14-Step-700",
            "adapter_sha256": actual_adapter_sha,
            "base_metadata_verified": True,
            "adapter_config_status": "verified",
            "a1_prompt_sha256": prompt_sha,
        }
        return True

    def load_model(self, base_path: str, adapter_path: str, use_4bit: bool = True, device_map: str = "auto") -> bool:
        """Load Qwen3-14B base + Step-700 PEFT LoRA adapter."""
        if not self.is_verified:
            return False
        try:
            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
            from peft import PeftModel

            logger.info("Initializing AutoTokenizer...")
            self.tokenizer = AutoTokenizer.from_pretrained(base_path, trust_remote_code=False, local_files_only=True)
            if self.tokenizer.pad_token_id is None:
                self.tokenizer.pad_token_id = 151643  # <|endoftext|> (strictly distinct from eos_token_id 151645)

            logger.info("Configuring quantization...")
            bnb_config = None
            if use_4bit and not torch.cuda.is_available():
                raise RuntimeError("The configured 4-bit runtime requires CUDA.")
            if use_4bit:
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
                trust_remote_code=False, local_files_only=True,
                low_cpu_mem_usage=True,
                use_safetensors=True,
            )

            logger.info("Applying Step-700 LoRA adapter...")
            self.model = PeftModel.from_pretrained(base_model, adapter_path, local_files_only=True)
            self.model.eval()
            runtime_versions = {"python": platform.python_version(), "cuda": torch.version.cuda}
            for package in ("torch", "transformers", "peft", "accelerate", "bitsandbytes"):
                try:
                    runtime_versions[package] = version(package)
                except PackageNotFoundError:
                    runtime_versions[package] = None
            self.attestation_data.update(is_verified=True, runtime_versions=runtime_versions)
            self.is_ready = True
            logger.info("PixiuMind Step-700 persistent loader ready!")
            return True

        except Exception as e:
            logger.error(f"Failed to load model into memory: {e}", exc_info=True)
            self.reset()
            return False

model_holder = ModelHolder()
