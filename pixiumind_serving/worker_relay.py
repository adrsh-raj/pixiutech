"""Relay a loopback generation to the job that the Kaggle worker already owns."""

import json
import time

import httpx


def relay_generation(client, local_token, django_url, worker_secret, worker_id, job_id, payload):
    upload_url = f"{django_url}/api/v1/xen/worker/jobs/{job_id}/chunk"
    seq = 0
    pending = ""
    last_upload = None

    def flush():
        nonlocal pending, seq, last_upload
        while pending:
            delta = pending[:4096]
            body = {"seq": seq + 1, "delta": delta, "worker_id": worker_id}
            for attempt in range(2):
                try:
                    response = client.post(upload_url, headers={"X-Worker-Secret": worker_secret},
                                           json=body, timeout=5)
                    response.raise_for_status()
                    break
                except httpx.TransportError:
                    if attempt:
                        raise
            seq += 1
            pending = pending[len(delta):]
            last_upload = time.monotonic()

    with client.stream("POST", "http://127.0.0.1:8000/internal/worker/generation",
                       headers={"Authorization": f"Bearer {local_token}"}, json=payload, timeout=120) as stream:
        stream.raise_for_status()
        for line in stream.iter_lines():
            event = json.loads(line)
            if "delta" in event:
                pending += event["delta"]
                if last_upload is None or time.monotonic() - last_upload >= 0.2 or len(pending) >= 512:
                    flush()
            elif "completion" in event:
                flush()
                return event["completion"]
            else:
                raise RuntimeError("Private generation failed")
    raise RuntimeError("Private generation ended before completion")
