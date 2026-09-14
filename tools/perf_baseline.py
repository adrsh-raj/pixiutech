#!/usr/bin/env python3
"""Privacy-safe read-only HTTP performance baseline for Pixiu.

Single endpoint:
  python tools/perf_baseline.py --base-url https://pixiu-django-api.onrender.com/api/v1 --path /classes --requests 100 --concurrency 25 --auth-env PIXIU_PERF_TOKEN

Full Phase 0 matrix:
  python tools/perf_baseline.py --base-url https://pixiu-django-api.onrender.com/api/v1 --all-endpoints --requests 100 --concurrencies 1,10,25,50,100 --auth-env PIXIU_PERF_TOKEN --csv phase0-api.csv

Tokens are read only from an environment variable and are never printed or persisted.
Response bodies, cookies, auth values, query strings and SQL are never printed or persisted.
When PERF_DIAGNOSTICS=true is enabled on Django, aggregate DB metrics are read from
safe response headers and written to the optional CSV.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import csv
import os
import statistics
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

DEFAULT_ENDPOINTS = [
    "/health/", "/auth/me/", "/schools", "/classes", "/students", "/trainers",
    "/sessions", "/attendance", "/leads", "/content", "/curriculum", "/inventory",
    "/billing", "/comms", "/projects", "/notifications", "/reviews", "/quizzes",
    "/quiz-submissions", "/kits",
]


@dataclass(frozen=True)
class Result:
    elapsed_ms: float
    status: int
    db_queries: int | None = None
    db_time_ms: float | None = None
    server_duration_ms: float | None = None
    error: str | None = None


def percentile(values: list[float], p: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int((p / 100) * len(ordered)))]


def safe_float(value: str | None) -> float | None:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def safe_int(value: str | None) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def one_request(url: str, token: str | None, timeout: float) -> Result:
    request = urllib.request.Request(url, method="GET")
    request.add_header("Accept", "application/json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            while response.read(64 * 1024):
                pass
            return Result(
                (time.perf_counter() - started) * 1000,
                int(response.status),
                safe_int(response.headers.get("X-Pixiu-Perf-DB-Queries")),
                safe_float(response.headers.get("X-Pixiu-Perf-DB-Time-Ms")),
                safe_float(response.headers.get("X-Pixiu-Perf-Duration-Ms")),
            )
    except urllib.error.HTTPError as exc:
        try:
            while exc.read(64 * 1024):
                pass
        except Exception:
            pass
        return Result((time.perf_counter() - started) * 1000, int(exc.code), error="http_error")
    except Exception as exc:
        return Result((time.perf_counter() - started) * 1000, 0, error=type(exc).__name__)


def run(url: str, token: str | None, total: int, concurrency: int, timeout: float) -> list[Result]:
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(total, concurrency)) as pool:
        futures = [pool.submit(one_request, url, token, timeout) for _ in range(total)]
        return [future.result() for future in concurrent.futures.as_completed(futures)]


def summarize(endpoint: str, concurrency: int, results: list[Result]) -> dict[str, object]:
    elapsed = [item.elapsed_ms for item in results]
    successes = [item for item in results if 200 <= item.status < 400]
    http_errors = [item for item in results if 400 <= item.status < 600]
    server_errors = [item for item in results if item.status >= 500 or (item.status == 0 and item.error)]
    db_queries = [float(item.db_queries) for item in results if item.db_queries is not None]
    db_time = [item.db_time_ms for item in results if item.db_time_ms is not None]
    server_duration = [item.server_duration_ms for item in results if item.server_duration_ms is not None]
    breakdown: dict[str, int] = {}
    for item in http_errors:
        key = str(item.status)
        breakdown[key] = breakdown.get(key, 0) + 1
    for item in results:
        if item.status == 0 and item.error:
            breakdown[item.error] = breakdown.get(item.error, 0) + 1

    return {
        "endpoint": endpoint,
        "requests": len(results),
        "concurrency": concurrency,
        "success_2xx_3xx": len(successes),
        "http_errors_4xx_5xx": len(http_errors),
        "server_or_transport_errors": len(server_errors),
        "error_breakdown": ",".join(f"{k}:{v}" for k, v in sorted(breakdown.items())),
        "p50_ms": round(percentile(elapsed, 50) or 0, 2),
        "p95_ms": round(percentile(elapsed, 95) or 0, 2),
        "p99_ms": round(percentile(elapsed, 99) or 0, 2),
        "mean_ms": round(statistics.fmean(elapsed), 2),
        "min_ms": round(min(elapsed), 2),
        "max_ms": round(max(elapsed), 2),
        "db_headers_seen": bool(db_queries and db_time and server_duration),
        "db_queries_p50": round(percentile(db_queries, 50) or 0, 2) if db_queries else None,
        "db_queries_max": int(max(db_queries)) if db_queries else None,
        "db_time_p50_ms": round(percentile(db_time, 50) or 0, 2) if db_time else None,
        "db_time_p95_ms": round(percentile(db_time, 95) or 0, 2) if db_time else None,
        "db_time_p99_ms": round(percentile(db_time, 99) or 0, 2) if db_time else None,
        "server_duration_p50_ms": round(percentile(server_duration, 50) or 0, 2) if server_duration else None,
        "server_duration_p95_ms": round(percentile(server_duration, 95) or 0, 2) if server_duration else None,
        "server_duration_p99_ms": round(percentile(server_duration, 99) or 0, 2) if server_duration else None,
    }


def parse_endpoints(path: str | None, all_endpoints: bool) -> list[str]:
    if all_endpoints:
        return DEFAULT_ENDPOINTS
    if not path:
        raise ValueError("provide --path or --all-endpoints")
    return [value if value.startswith("/") else f"/{value}" for value in path.split(",") if value.strip()]


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only Pixiu API performance baseline")
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--path", help="One path or comma-separated paths")
    parser.add_argument("--all-endpoints", action="store_true")
    parser.add_argument("--requests", type=int, default=100)
    parser.add_argument("--concurrency", type=int, default=10)
    parser.add_argument("--concurrencies", default="", help="Comma-separated levels, e.g. 1,10,25,50,100")
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--auth-env", default="", help="Environment variable containing a bearer token")
    parser.add_argument("--csv", default="", help="Optional aggregate CSV path")
    args = parser.parse_args()

    if args.requests < 1 or args.timeout <= 0:
        parser.error("requests and timeout must be positive")
    try:
        endpoints = parse_endpoints(args.path, args.all_endpoints)
    except ValueError as exc:
        parser.error(str(exc))

    raw_levels = args.concurrencies or str(args.concurrency)
    try:
        concurrency_values = [int(value.strip()) for value in raw_levels.split(",") if value.strip()]
    except ValueError:
        parser.error("concurrencies must contain integers")
    if not concurrency_values or any(value < 1 for value in concurrency_values):
        parser.error("concurrencies must contain positive integers")

    token = os.environ.get(args.auth_env) if args.auth_env else None
    rows: list[dict[str, object]] = []
    for endpoint in endpoints:
        url = args.base_url.rstrip("/") + "/" + endpoint.lstrip("/")
        for concurrency in concurrency_values:
            row = summarize(endpoint, concurrency, run(url, token, args.requests, concurrency, args.timeout))
            rows.append(row)
            print(
                f"endpoint={endpoint} concurrency={concurrency} requests={row['requests']} "
                f"2xx_3xx={row['success_2xx_3xx']} 4xx_5xx={row['http_errors_4xx_5xx']} "
                f"server_transport_errors={row['server_or_transport_errors']} "
                f"p50_ms={row['p50_ms']:.2f} p95_ms={row['p95_ms']:.2f} p99_ms={row['p99_ms']:.2f} "
                f"db_queries_p50={row['db_queries_p50']} db_time_p50_ms={row['db_time_p50_ms']}"
            )

    if args.csv:
        destination = Path(args.csv)
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()) if rows else [])
            writer.writeheader()
            writer.writerows(rows)
        print(f"csv_written={destination}")

    return 0 if all(row["server_or_transport_errors"] == 0 for row in rows) else 2


if __name__ == "__main__":
    raise SystemExit(main())
