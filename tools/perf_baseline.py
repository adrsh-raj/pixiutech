#!/usr/bin/env python3
"""Privacy-safe read-only HTTP baseline for the Pixiu API.

Usage examples:
  python tools/perf_baseline.py --base-url https://pixiu-django-api.onrender.com/api/v1 --path /health/ --requests 100 --concurrency 25
  PIXIU_PERF_TOKEN='...' python tools/perf_baseline.py --base-url https://pixiu-django-api.onrender.com/api/v1 --path /students --requests 100 --concurrency 25 --auth-env PIXIU_PERF_TOKEN

Only HTTP status, elapsed time and transport errors are collected. Response
bodies, headers, cookies, authorization values and query strings are never
printed or persisted.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import os
import statistics
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class Result:
    elapsed_ms: float
    status: int
    error: str | None = None


def percentile(values: list[float], p: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, int((p / 100) * len(ordered)))
    return ordered[index]


def one_request(url: str, token: str | None, timeout: float) -> Result:
    request = urllib.request.Request(url, method="GET")
    request.add_header("Accept", "application/json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            # Read and discard the body to measure the complete response transfer,
            # but never expose or save it.
            while response.read(64 * 1024):
                pass
            elapsed_ms = (time.perf_counter() - started) * 1000
            return Result(elapsed_ms, int(response.status))
    except urllib.error.HTTPError as exc:
        # Consume/discard without logging the response body.
        try:
            while exc.read(64 * 1024):
                pass
        except Exception:
            pass
        return Result((time.perf_counter() - started) * 1000, int(exc.code), "http_error")
    except Exception as exc:  # transport failures; message is intentionally generalized
        return Result((time.perf_counter() - started) * 1000, 0, type(exc).__name__)


def run(url: str, token: str | None, total: int, concurrency: int, timeout: float) -> list[Result]:
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = [pool.submit(one_request, url, token, timeout) for _ in range(total)]
        return [future.result() for future in concurrent.futures.as_completed(futures)]


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only Pixiu API performance baseline")
    parser.add_argument("--base-url", required=True, help="API base URL, e.g. https://host/api/v1")
    parser.add_argument("--path", required=True, help="Read-only path, e.g. /health/ or /students")
    parser.add_argument("--requests", type=int, default=100)
    parser.add_argument("--concurrency", type=int, default=10)
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--auth-env", default="", help="Environment variable containing a bearer token")
    args = parser.parse_args()

    if args.requests < 1 or args.concurrency < 1 or args.timeout <= 0:
        parser.error("requests, concurrency and timeout must be positive")

    # Never accept tokens on the command line; this avoids shell history/process-list leaks.
    token = os.environ.get(args.auth_env) if args.auth_env else None
    url = args.base_url.rstrip("/") + "/" + args.path.lstrip("/")
    results = run(url, token, args.requests, min(args.concurrency, args.requests), args.timeout)

    elapsed = [item.elapsed_ms for item in results]
    successes = [item for item in results if 200 <= item.status < 400]
    errors = [item for item in results if item.error or item.status == 0 or item.status >= 500]

    print(f"requests={len(results)} concurrency={min(args.concurrency, args.requests)}")
    print(f"successful_2xx_3xx={len(successes)} errors={len(errors)}")
    print(f"p50_ms={percentile(elapsed, 50):.2f}")
    print(f"p95_ms={percentile(elapsed, 95):.2f}")
    print(f"p99_ms={percentile(elapsed, 99):.2f}")
    print(f"min_ms={min(elapsed):.2f} max_ms={max(elapsed):.2f} mean_ms={statistics.fmean(elapsed):.2f}")
    if errors:
        by_status: dict[str, int] = {}
        for item in errors:
            key = str(item.status) if item.status else (item.error or "transport_error")
            by_status[key] = by_status.get(key, 0) + 1
        print("error_breakdown=" + ",".join(f"{k}:{v}" for k, v in sorted(by_status.items())))
    return 0 if not errors else 2


if __name__ == "__main__":
    raise SystemExit(main())
