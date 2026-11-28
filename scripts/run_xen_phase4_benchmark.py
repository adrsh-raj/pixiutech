#!/usr/bin/env python3
"""
Phase 4 Benchmark Runner for Xen Step-700 Intelligence & Grounding Evaluation.

Supports strictly separated tracks:
- track-b-local: Runs the local Phase 1-3 Django pipeline (routing, mode selection,
  effective prompt construction, authoritative grounding spec, history quarantine,
  and deterministic grounded verifier/fallback). NEVER claims to execute real GPU inference.
- track-a-remote / track-c-remote: Submits the fixed benchmark prompts to an
  authorized Render/Staging API endpoint when XEN_EVAL_BEARER_TOKEN is provided by
  the operator, recording real job_id, worker_id, tokens, latency, and grounding checks.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.request
import uuid

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "pixiu-backend"
DEFAULT_BENCHMARK = BACKEND_DIR / "core" / "benchmarks" / "xen_step700_phase4_benchmark.json"


def compute_benchmark_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run_track_b_local(benchmark: dict) -> dict:
    sys.path.insert(0, str(BACKEND_DIR))
    from core.xen_intent import (
        XenResponseMode,
        build_xen_effective_prompt,
        is_circuit_specific_query,
        resolve_xen_response_mode,
    )
    from core.xen_grounding import (
        build_authoritative_grounding_spec,
        build_deterministic_grounded_fallback,
        extract_and_validate_grounding_claims,
        filter_and_compact_xen_history,
    )

    fixtures = benchmark["fixtures"]
    results = []

    for item in benchmark["core_scenarios"] + benchmark["secondary_cases"]:
        fix_name = item.get("fixture")
        env = fixtures.get(fix_name) if fix_name else None
        history = item.get("history") or []
        prompt = item["prompt"]

        routed_circuit = is_circuit_specific_query(prompt, history, context_envelope=env)
        mode, mode_source = resolve_xen_response_mode(prompt, history=history)
        spec = build_authoritative_grounding_spec(env) if (routed_circuit and env) else None
        compacted_hist = filter_and_compact_xen_history(
            history,
            mode,
            sanitize_fn=lambda s: str(s).strip(),
            current_circuit_revision=env.get("circuit_revision") if env else None,
            current_spec=spec,
        )
        eff_prompt = build_xen_effective_prompt(
            prompt=prompt,
            format_mode=mode,
            context_envelope=env,
            history=history,
            max_chars=4000,
        )

        # Verify expected routing / mode / directives
        route_ok = True
        if "expected_circuit_route" in item:
            route_ok = routed_circuit == item["expected_circuit_route"]
        mode_ok = True
        if "expected_mode" in item:
            mode_ok = mode.value == item["expected_mode"]

        # Verify grounded deterministic fallback & verifier behavior on circuit fixtures
        fallback_text = None
        fallback_verified = None
        adversarial_caught = None
        if routed_circuit and spec and spec.get("has_circuit"):
            fallback_text = build_deterministic_grounded_fallback(spec, prompt, "", ["ungrounded"], [])
            check_fb = extract_and_validate_grounding_claims(fallback_text, spec, prompt)
            fallback_verified = bool(check_fb["verified"])
            # Probe that forbidden 100/100 / blinking claims fail verifier on non-running/empty fixtures
            if fix_name in ("empty_canvas", "wrong_pin_d9_vs_d5", "missing_ground", "reverse_polarity", "correct_led_stopped"):
                adv = extract_and_validate_grounding_claims(
                    "All connections intact! Health score 100/100 and the LED is currently blinking cleanly.",
                    spec,
                    prompt,
                )
                adversarial_caught = not adv["verified"]

        passed = route_ok and mode_ok and (fallback_verified in (None, True)) and (adversarial_caught in (None, True))
        results.append(
            {
                "id": item["id"],
                "execution_source": "track_b_local_pipeline_deterministic_no_model",
                "routed_circuit": routed_circuit,
                "route_ok": route_ok,
                "mode": mode.value,
                "mode_source": mode_source,
                "mode_ok": mode_ok,
                "effective_prompt_sha256": hashlib.sha256(eff_prompt.encode("utf-8")).hexdigest(),
                "effective_prompt_chars": len(eff_prompt),
                "has_grounding_directive": "[CYBERLAB GROUNDING DIRECTIVE:" in eff_prompt,
                "has_mission_context": "[MISSION CONTEXT]" in eff_prompt,
                "compacted_history_count": len(compacted_hist),
                "fallback_verified": fallback_verified,
                "adversarial_hallucination_caught": adversarial_caught,
                "passed": passed,
            }
        )

    return {
        "track": "TRACK_B_LOCAL_PIPELINE",
        "real_model_inference": False,
        "total": len(results),
        "passed": sum(1 for r in results if r["passed"]),
        "failed": sum(1 for r in results if not r["passed"]),
        "items": results,
    }


def run_remote_track(benchmark: dict, track: str, base_url: str) -> dict:
    token = os.environ.get("XEN_EVAL_BEARER_TOKEN", "").strip()
    if not token:
        raise RuntimeError(
            "BLOCKED: XEN_EVAL_BEARER_TOKEN is not set. An authorized tester JWT obtained via the owner's "
            "authenticated Portal session is required to invoke /api/v1/xen/jobs."
        )
    fixtures = benchmark["fixtures"]
    results = []
    for item in benchmark["core_scenarios"] + benchmark["secondary_cases"]:
        env = fixtures.get(item.get("fixture")) if item.get("fixture") else None
        payload = json.dumps(
            {
                "prompt": item["prompt"],
                "history": item.get("history") or [],
                "context_envelope": env,
                "idempotency_key": f"p4-{track}-{item['id']}-{uuid.uuid4().hex[:8]}",
                "job_mode": True,
            }
        ).encode("utf-8")
        req = urllib.request.Request(
            f"{base_url.rstrip('/')}/api/v1/xen/jobs",
            data=payload,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            results.append({"id": item["id"], "submit": json.loads(resp.read().decode("utf-8"))})
    return {"track": track, "real_model_inference": True, "items": results}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--benchmark", type=Path, default=DEFAULT_BENCHMARK)
    parser.add_argument("--mode", choices=["track-b-local", "track-a-remote", "track-c-remote"], required=True)
    parser.add_argument("--base-url", default="https://pixiu-django-api.onrender.com")
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()

    benchmark = json.loads(args.benchmark.read_text(encoding="utf-8"))
    bench_hash = compute_benchmark_sha256(args.benchmark)

    if args.mode == "track-b-local":
        summary = run_track_b_local(benchmark)
    else:
        summary = run_remote_track(benchmark, args.mode.upper(), args.base_url)

    out_doc = {
        "benchmark_id": benchmark["benchmark_id"],
        "benchmark_sha256": bench_hash,
        **summary,
    }
    rendered = json.dumps(out_doc, indent=2)
    if args.output:
        args.output.write_text(rendered, encoding="utf-8")
    print(json.dumps({k: v for k, v in out_doc.items() if k != "items"}, indent=2))
    return 0 if out_doc.get("failed", 0) == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
