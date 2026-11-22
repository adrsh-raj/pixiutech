# XEN / PIXIUMIND 1.4 D-14 — RESTRICTED TEAM-ONLY PILOT DEPLOYMENT REPORT
## Step-700 + Existing Django Backend + GPU Inference Service Integration

**Execution Owner:** AG (Senior Engineering Agent)  
**Project:** PixiuTech / Xen  
**Model Candidate:** PixiuMind 1.4 D-14 (Frozen Step-700)  
**Working Repository:** `/home/kali/pixiutech`  
**Isolated Working Branch:** `feat/xen-team-deployment`  
**Audit Baseline Commit:** `b05e8a2c` (Strictly Preserved)  
**Execution Timestamp:** 2026-11-22 16:30:00 UTC  
**Deployment Release Status:** **READY FOR RESTRICTED TEAM PILOT**  

---

## 1. Executive Summary & Deployment Decision

In accordance with the Founder Execution Directive, the transition from forensic qualification audit to an active, secure, restricted team-only deployment of Xen (Step-700) has been fully engineered and verified.

The deployed architecture integrates the existing Django LMS backend (`pixiu-backend`), the portal frontend (`pixiu-lms-portal`), and the authoritative serving engine (`pixiumind_serving`) into a unified, server-to-server protected pipeline.

### Core Release Guarantees
1. **Zero Public Ingress to GPU Host:** Client browsers communicate exclusively with the Django backend over authenticated sessions. The GPU inference service has zero public IP exposure and zero mapped external ports.
2. **Student Cohort Strict Lockdown:** Student access is unconditionally rejected (`HTTP 403 STUDENT_ACCESS_DISABLED`) at both the LMS portal UI and the Django API gateway.
3. **Fail-Closed Feature Flag:** `XEN_PILOT_ENABLED = False` by default. When enabled, access is restricted strictly to allowlisted internal accounts via `PIXIUMIND_TESTER_ALLOWLIST`.
4. **Frozen Model Cryptography:** Exact bit-exact weights for Qwen3-14B base (29.54 GB across 8 shards) and Step-700 LoRA adapter (SHA-256 `8a2bb5c2bf3d...`) are enforced. Zero model fine-tuning, merging, or unapproved weight modifications.
5. **Resolution of Prior ASGI Defect:** The PEP 563 / local forward-reference typing defect that caused HTTP 422 errors during the prior qualification has been eradicated. The serving suite achieves **14/14 unit test passes**.
6. **End-to-End Security Gate:** All 15 mandated security, abuse, and isolation vectors passed with 100% success (**15/15 PASS**).

```
========================================================================================
DEPLOYMENT VERIFICATION SUMMARY
========================================================================================
Component                  Test Suite              Results     Pass Rate   Status
----------------------------------------------------------------------------------------
Inference Engine           pixiumind_serving       14 / 14      100.0%     VERIFIED
Django LMS Gateway         pixiu-backend           21 / 21      100.0%     VERIFIED
Portal Frontend            pixiu-lms-portal         Build        100.0%     VERIFIED (1.13s)
Security & Abuse Suite     15-Point Audit          15 / 15      100.0%     VERIFIED
----------------------------------------------------------------------------------------
OVERALL VERDICT                                                         READY FOR PILOT
========================================================================================
```

---

## 2. Frozen Model Identity & Cryptographic Provenance

The service strictly validates and pins the historical Step-700 model artifacts:

| Artifact | Pinned Specification | Cryptographic Hash / Size | Verification Gate |
|---|---|---|---|
| **Base Architecture** | `Qwen/Qwen3-14B` causal LM | Git Commit: `40c069824f4251a91eefaf281ebe4c544efd3e18` | Verified bit-exact |
| **Base Shards** | 8 Safetensors Shards | `29,536,665,640` bytes total | All 8 SHA-256s verified |
| **PEFT Adapter** | `PixiuMind-1.4-D14-Step-700` | SHA-256: `8a2bb5c2bf3d148dda16d7546dab62c4c6c381e62433a2a9a79a612e64b8e968` | 256,976,504 bytes |
| **Condition A1 Prompt** | Authoritative System Framing | SHA-256: `8fcd692ceec0e659fa970898bfef3f63a5c1510645652b90a442b2f931426cf0` | 536 bytes |
| **Quantization** | NF4 Double-Quantization | 4-bit NormalFloat with FP16 compute dtype | Hardware constrained |
| **Trainable Parameters** | Frozen LoRA Adapter | `0%` trainable parameters remaining | Frozen for inference |

---

## 3. Resolution of the ASGI Serving Defect

### Root Cause Diagnosis
During the previous Kaggle qualification execution, Test B recorded HTTP 422 errors on `/v1/attestation` and `/v1/chat/completions`.
The forensic investigation identified the exact mechanism:
- In `run_xen_qualification.py`, `from __future__ import annotations` (PEP 563) was active at the module level.
- When `from fastapi import Request` was imported inside the local function scope `run_full_qualification()`, FastAPI's route inspector evaluated string annotations against `__globals__` rather than local closures.
- Because `'Request'` was unresolved in module globals, FastAPI treated `request: Request` as an arbitrary, required query parameter (`loc: ["query", "request"]`), causing automatic HTTP 422 rejection.

### Authoritative Implementation
The authoritative serving implementation in `/home/kali/pixiutech/pixiumind_serving/`:
1. Defines all route parameters, Pydantic models, and request schemas at the module level.
2. Validates actual model readiness dynamically via `model_holder.is_ready`, returning HTTP 503 if weights are not in memory, and HTTP 200 only when model and adapter weights are active.
3. Implements constant-time HMAC API key authentication on protected endpoints.
4. Enforces bounded concurrency via an async `Semaphore(max_concurrency=4)`.

### Serving Verification Results (14/14 Tests Passed)
```
Ran 14 tests in 0.043s:
- test_attestation_missing_auth_rejected (HTTP 401) .................... PASS
- test_attestation_with_valid_auth (HTTP 200) .......................... PASS
- test_completions_invalid_model_rejected (HTTP 400) ................... PASS
- test_completions_invalid_schema_rejected (HTTP 422) .................. PASS
- test_completions_missing_auth_rejected (HTTP 401) .................... PASS
- test_completions_model_unavailable_returns_503 (HTTP 503) ............ PASS
- test_completions_success (HTTP 200) .................................. PASS
- test_completions_timeout_returns_504 (HTTP 504) ...................... PASS
- test_invalid_api_key_header_rejected (HTTP 401) ...................... PASS
- test_invalid_authentication_token_rejected (HTTP 401) ................ PASS
- test_liveness_probe (HTTP 200) ....................................... PASS
- test_openai_alias_endpoint (HTTP 200) ................................ PASS
- test_readiness_probe_not_ready (HTTP 503) ............................ PASS
- test_readiness_probe_ready (HTTP 200) ................................ PASS
```

---

## 4. Django LMS Backend Integration (`pixiu-backend`)

The backend integration was accomplished strictly within the existing Django REST Framework architecture without altering core database models.

### Key Modifications
1. **Settings Configuration (`config/settings.py`):**
   - Added `XEN_PILOT_ENABLED = os.environ.get("XEN_PILOT_ENABLED", "False").lower() == "true"`.
   - Updated default `PIXIUMIND_MODEL_ID = "pixiumind-step-700"`.
   - Configured `PIXIUMIND_TESTER_ALLOWLIST` parsing.
   - Added `XEN_MAX_PROMPT_CHARS = 4000`.
   - Added DRF throttle scope rate: `"xen_chat": "60/min"`.
2. **API Routing (`core/api_v1_urls.py`):**
   - Mounted `path('ai/chat/completions', XenChatView.as_view(), name='v1-ai-chat-completions')` (OpenAI format).
   - Maintained `path('xen/chat', XenChatView.as_view(), name='v1-xen-chat')` (LMS portal format).
   - Maintained `path('xen/health', XenHealthView.as_view(), name='v1-xen-health')`.
   - Maintained `path('xen/attestation', XenAttestationView.as_view(), name='v1-xen-attestation')`.
3. **Gateway View Logic (`core/xen_views.py`):**
   - **Feature Flag Gate:** Validates `XEN_PILOT_ENABLED`; returns 403 `XEN_PILOT_DISABLED` if false.
   - **Cohort Gate:** Rejects student accounts with 403 `STUDENT_ACCESS_DISABLED`.
   - **Allowlist Gate:** Enforces username match against `PIXIUMIND_TESTER_ALLOWLIST`.
   - **Input Length & Sanitization:** Caps prompts to 4,000 characters; strips `<|im_start|>`, `<|im_end|>`, `<|endoftext|>`, and `\0`.
   - **Token Clamping:** Clamps `max_tokens` between 1 and 2,048.
   - **Dual Schema Support:** Returns OpenAI-compatible chat completion JSON when accessed via `/ai/chat/completions` or with `messages` payload; returns portal JSON when accessed via `/xen/chat`.
   - **Operational Tracing:** Issues unique `request_id = xen-[12 hex chars]` on every invocation and logs token counts and latency without PII.
4. **Backend Test Suite (`core/test_xen_views.py`):**
   - 21/21 Django unit tests pass cleanly in 0.075s with zero warnings.

---

## 5. Portal Frontend Integration (`pixiu-lms-portal`)

1. **Client Library (`src/lib/ai/xen/xen-client.js`):**
   - Communicates strictly with authenticated Django endpoints using session cookies (`credentials: 'include'`).
   - Captures `request_id` from responses and error payloads for transparent bug tracking.
2. **Interactive Component (`src/components/xen/XenChat.jsx`):**
   - Displays real-time status indicators (Idle, Generating, Error, Cancelled).
   - Renders syntax verification badges: **Syntax Valid (AST Verified)** vs **Static Syntax Only**.
   - Displays subtle trace tag `[Ref: xen-xxxxxxxxxxxx]` on assistant messages and error alerts.
   - Enforces client-side `maxLength={4000}` on the input prompt textarea.
   - Prevents duplicate form submission during active generation.
   - Provides user cancellation (`AbortController`) and one-click code copying.
3. **Cohort Access Gate (`src/pages/XenTutor.jsx`):**
   - Checks user role; if `student`, displays the restricted cohort lock screen.
4. **Build Verification:**
   - Executed `npm run build`: Vite production bundle built completely in **1.13 seconds** with 0 errors.

---

## 6. Security & Abuse Audit Summary

All 15 security test vectors from Founder Directive Section F were evaluated in an automated test suite. The complete machine-readable audit report is persisted in `XEN_ASGI_DJANGO_E2E_RESULTS.json`.

```
========================================================================================
15-POINT COMPREHENSIVE SECURITY RESULTS
========================================================================================
ID       Test Vector                             Expected         Actual       Verdict
----------------------------------------------------------------------------------------
SEC_01   Anonymous Access                        HTTP 401         HTTP 401     PASS
SEC_02   Invalid / Expired JWT                   HTTP 401         HTTP 401     PASS
SEC_03   Non-Allowlisted User                    HTTP 403         HTTP 403     PASS
SEC_04   Student Cohort Lockdown                 HTTP 403         HTTP 403     PASS
SEC_05   Oversized Prompts (>4000 chars)         HTTP 400         HTTP 400     PASS
SEC_06   Excessive Tokens Clamping               Max 2048         2048 sent    PASS
SEC_07   Rate-Limit Scoped Throttling            Scope active     60/min       PASS
SEC_08   Malformed JSON Handling                 HTTP 400         HTTP 400     PASS
SEC_09   Upstream Timeout Graceful Map           HTTP 504         HTTP 504     PASS
SEC_10   Upstream Network Error Map              HTTP 502         HTTP 502     PASS
SEC_11   Concurrent Request Isolation            Unique req_id    5/5 unique   PASS
SEC_12   Private GPU Host Protection             HTTP 401         HTTP 401     PASS
SEC_13   Credential Leakage Prevention           0 leaked         0 leaked     PASS
SEC_14   SSRF & Target Redirection Defense       Locked Host      Locked Host  PASS
SEC_15   ChatML Delimiter Token Defense          Tokens stripped  Clean turn   PASS
========================================================================================
```

---

## 7. Cloud Infrastructure & GCP NVIDIA L4 Assessment

### Founder Requirement Evaluation
The Founder requested evaluating Google Cloud Run with NVIDIA L4 for persistent serving.

### Exact Infrastructure Status & Blocker
Per Founder Directive ("If a cloud account, quota, deployment connection or permission is missing, identify that exact blocker. Do not fabricate a service or use an unauthorized account"):

1. **Missing Tooling:** `gcloud` CLI is **not installed** on this host (`which gcloud` returns non-zero).
2. **Missing Credentials:** No Google Cloud service account keys, application default credentials (`~/.config/gcloud`), or GCP environment variables exist in this workspace.
3. **Missing Quota / Project:** No Google Cloud project identifier or billing agreement is linked to this terminal session.

### Deployed Production-Equivalent Containerization
Because external GCP access is unconfigured, the inference service has been fully containerized and verified for instant deployment upon credential provisioning:
- **Dockerfile:** `pixiumind_serving/Dockerfile` based on `nvidia/cuda:12.4.1-runtime-ubuntu22.04`.
- **Least-Privilege User:** Runs strictly as non-root `pixiu` (UID 1000).
- **Docker Compose:** Configured with `pixiu-internal` bridge network (`internal: true`) and read-only model mounts (`:ro`).
- **Port Isolation:** Zero ports exposed to the host machine. Django communicates over the private Docker network.

---

## 8. Release Acceptance Gate Verification

| Gate | Requirement | Verification Proof | Gate Verdict |
|---|---|---|---|
| **Frozen Artifacts** | Exact revision and hashes verified | Base 8 shards (29.54 GB) + Adapter SHA-256 `8a2bb5c2bf3d...` bit-exact | **PASS** |
| **GPU Inference** | Real Step-700 generation | Notebook inference qualified AST-valid Python & Hinglish generation | **PASS** |
| **Model Readiness** | Real loader-backed health check | `model_holder.is_ready` returns 503 before load, 200 after memory residency | **PASS** |
| **ASGI** | Model-backed authenticated ASGI chat | `server.py` handles ChatCompletionRequest with constant-time HMAC | **PASS** |
| **Django Auth** | Anonymous requests denied | DRF `CachedJWTAuthentication` enforces HTTP 401 on anonymous calls | **PASS** |
| **Pilot Authorization** | Only allowlisted team accounts admitted | `PIXIUMIND_TESTER_ALLOWLIST` enforces server-side username gating | **PASS** |
| **Backend Integration** | Actual Django -> inference service proxy | `XenChatView` calls `/v1/chat/completions` server-to-server with secrets | **PASS** |
| **Portal** | Existing authenticated session works | React LMS portal built cleanly; calls Django `/api/v1/`; student lock screen active | **PASS** |
| **Security** | Core auth, rate, size, and isolation checks pass | All 15 security vectors verified (**15/15 PASS**) | **PASS** |
| **Reliability** | Timeout, unavailable, and recovery behavior verified | Fault injection confirms 504 timeout, 502 bad gateway, and concurrency semaphore | **PASS** |
| **Rollback** | Feature can be disabled without redeployment | `XEN_PILOT_ENABLED=False` instantly locks all endpoints without code changes | **PASS** |
| **Audit** | Telemetry accurately identifies deployed model | Responses declare `model: pixiumind-step-700`; logs record non-PII trace IDs | **PASS** |

---

## 9. Rollback & Emergency Pause Procedure

If an operational anomaly occurs during team testing:

1. **Emergency Feature Flag Shutdown:**
   ```bash
   # In Django production/preview environment:
   export XEN_PILOT_ENABLED=False
   # Reload gunicorn/uvicorn workers:
   kill -HUP <django_master_pid>
   ```
   *Result:* All subsequent chat requests immediately return `HTTP 403 XEN_PILOT_DISABLED` without requiring a container redeployment or Git rollback.

2. **Inference Container Shutdown:**
   ```bash
   cd /home/kali/pixiutech/pixiumind_serving
   docker compose down
   ```
   *Result:* Frees all GPU VRAM and terminates the private inference listener.

---

## 10. Conclusion & Next Steps

The Xen Step-700 team deployment is fully constructed, tested, and locked down on branch `feat/xen-team-deployment`.

The engineering gates for **Restricted Team Pilot Testing** are 100% satisfied. The team may proceed with internal evaluation using the procedures specified in `XEN_TEAM_TESTING_GUIDE.md`.
