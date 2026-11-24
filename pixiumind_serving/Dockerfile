# PixiuMind Persistent Inference Service Dockerfile
# Pinned runtime environment matching M2 qualification
FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-dev \
    python3-pip \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

WORKDIR /app

# Install pinned ML runtime libraries
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
    torch==2.6.0 --index-url https://download.pytorch.org/whl/cu124 && \
    pip install --no-cache-dir \
    transformers==5.22.1 \
    peft==0.21.2 \
    accelerate==1.15.0 \
    bitsandbytes==0.50.2 \
    fastapi==0.115.0 \
    uvicorn==0.32.0 \
    pydantic==2.9.2

COPY config.py loader.py engine.py server.py /app/

# Least privilege user
RUN useradd -m -u 1000 pixiu && chown -R pixiu:pixiu /app
USER pixiu

EXPOSE 8000

# Private internal binding
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
