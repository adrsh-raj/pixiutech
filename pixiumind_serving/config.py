"""
Configuration settings for PixiuMind Persistent Inference Service.
"""

import os
from pydantic import BaseModel, Field

class ServingConfig(BaseModel):
    # Service bindings (Strictly private - bind to internal network interface or 127.0.0.1)
    host: str = Field(default=os.environ.get("PIXIUMIND_HOST", "127.0.0.1"))
    port: int = Field(default=int(os.environ.get("PIXIUMIND_PORT", "8000")))
    
    # Model provenance paths
    base_model_path: str = Field(
        default=os.environ.get(
            "PIXIUMIND_BASE_MODEL_PATH",
            "/media/kali/New Volume/XenArtifacts/Qwen3-14B-40c069824f4251a91eefaf281ebe4c544efd3e18",
        )
    )
    base_revision: str = Field(
        default=os.environ.get("PIXIUMIND_BASE_REVISION", "40c069824f4251a91eefaf281ebe4c544efd3e18")
    )
    adapter_path: str = Field(
        default=os.environ.get(
            "PIXIUMIND_ADAPTER_PATH",
            "/home/kali/pixai-dataset/_v4_candidate/14b_training_release/pixiumind_1_4_d14_c800_kaggle_launch/session1_v2_output/c800_run_1795006835_d9914f/checkpoints/pixiumind_1_4_c800_b2a_s2_213_global_step_700",
        )
    )
    expected_adapter_sha256: str = Field(
        default="8a2bb5c2bf3d148dda16d7546dab62c4c6c381e62433a2a9a79a612e64b8e968"
    )

    # Authentication secret (Server-to-server with Django only)
    api_key: str = Field(
        default=os.environ.get("PIXIUMIND_API_KEY", "pixiumind-private-staging-key-change-in-prod")
    )

    # Concurrency and timeout controls
    max_concurrency: int = Field(default=int(os.environ.get("PIXIUMIND_MAX_CONCURRENCY", "4")))
    queue_timeout_seconds: float = Field(default=float(os.environ.get("PIXIUMIND_QUEUE_TIMEOUT", "30.0")))
    inference_timeout_seconds: float = Field(default=float(os.environ.get("PIXIUMIND_TIMEOUT", "450.0")))

    # Model ID Whitelist
    allowed_models: list[str] = Field(
        default=["pixiumind-step-700", "pixiumind", "pixiumind-1.4", "qwen3-14b-step700"]
    )

    # Quantization and loader configuration
    use_4bit: bool = Field(default=os.environ.get("PIXIUMIND_USE_4BIT", "True").lower() == "true")
    device_map: str = Field(default=os.environ.get("PIXIUMIND_DEVICE_MAP", "auto"))

config = ServingConfig()
