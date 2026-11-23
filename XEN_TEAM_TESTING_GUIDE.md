# XEN / PIXIUMIND STEP-700 INTERNAL TEAM TESTING GUIDE
## Restricted Team Pilot Deployment & Evaluation Instructions

**Target Candidate:** PixiuMind 1.4 D-14 (Frozen Step-700)  
**Target Audience:** Internal Engineering, Product, and Academic Pilot Testers (Adult Trainers and Administrators only)  
**Release Phase:** Controlled Internal Team Preview (Closed Production)  
**Student Access:** **STRICTLY DISABLED** (`HTTP 403 STUDENT_ACCESS_DISABLED`)  

---

## 1. Overview & Objectives

This guide instructs authorized internal team members on how to interact with, evaluate, and report findings on **PixiuMind Xen (Step-700)** during the restricted team pilot phase.

The objective of this pilot is to validate:
1. End-to-end integration between the LMS portal frontend, Django API gateway, and private GPU inference service.
2. Step-700 pedagogical output quality for K-12 Python programming, computational thinking, and bilingual (English/Hinglish) STEM tutoring.
3. System reliability, token boundaries, and operational error tracing under realistic multi-turn usage.

---

## 2. Access Prerequisites & Configuration

### Environment Configuration (Server-Side)
Before team testing commences, verify the following Django environment variables are configured on the preview/staging server:

```bash
# Enable the Xen Pilot feature gate (Default is False)
export XEN_PILOT_ENABLED=True

# Allowlist specific internal tester usernames (comma-separated)
export PIXIUMIND_TESTER_ALLOWLIST="founder_admin,trainer_alice,lead_dev"

# Upstream GPU Inference Service Connection
export PIXIUMIND_ENDPOINT_URL="http://127.0.0.1:8000"  # or private VPC bridge URL
export PIXIUMIND_API_KEY="<PROVISIONED_SERVER_TO_SERVER_KEY>"
export PIXIUMIND_MODEL_ID="pixiumind-step-700"
export PIXIUMIND_TIMEOUT_SECONDS=30
export XEN_MAX_PROMPT_CHARS=4000

# Shared Redis Server for Atomic Rate Limiting (Required - Fails closed if missing)
export REDIS_URL="redis://127.0.0.1:6379/0"
```

### Tester Account Requirements
- **Role:** Must be logged in as an **Admin** or **Trainer**.
- **Username:** Must match an entry in `PIXIUMIND_TESTER_ALLOWLIST`.
- **Student & School Lockdown:** Any attempt to log in using a student test account (`HTTP 403 STUDENT_ACCESS_DISABLED`) or school account (`HTTP 403 SCHOOL_ACCESS_DISABLED`) will display the restricted cohort lock screen. Xen Tutor navigation is exclusively visible to authorized Admins and Trainers.

---

## 3. How to Access the Xen Workspace

1. **Log in to LMS Portal:**
   - Navigate to the LMS portal URL (e.g. `http://localhost:5173` or staging preview domain).
   - Sign in with your authorized Trainer or Admin account.
2. **Open Xen Tutor:**
   - In the left sidebar navigation under **LAB** or **LAB TOOLS**, click **PixiuMind Xen Tutor** (or navigate directly to `/xen`).
3. **Workspace View:**
   - The workspace header will display:
     `PixiuMind Xen Tutor [STEP-700]` along with your active account role.

---

## 4. Test Scenarios & Suggested Prompts

### Scenario A — Python Programming & Syntax Verification
- **Prompt:** `"Write a Python function called find_max(numbers) that returns the maximum number in a list without using the built-in max() function."`
- **Expected Behavior:**
  - Complete, indented Python function in a formatted code block.
  - Green badge displaying **Syntax Valid (AST Verified)**.
  - Subtitle displaying **Static Syntax Only** (confirming zero server execution).
  - Single-click **Copy** button copies the code cleanly.

### Scenario B — Bilingual (English/Hinglish) Indian Classroom Scaffolding
- **Prompt:** `"Mujhe Python mein for loop aur while loop ka difference samjhao with a simple real-life example."`
- **Expected Behavior:**
  - Natural, supportive Hinglish explanation.
  - Accurate pedagogical analogy (e.g., counting steps vs waiting until light turns green).
  - Clear syntax examples for both loops.

### Scenario C — Conceptual Hinting (No Code Spoilers)
- **Select Intent:** Choose **Teaching Scaffolding** in the intent dropdown.
- **Prompt:** `"I need a hint on how to reverse a string in Python without using [::-1]. Don't give me the code yet."`
- **Expected Behavior:**
  - Conceptual explanation using string accumulation or a backward index pointer.
  - Zero raw solution code leaked.

### Scenario D — Special Delimiter Resistance Test
- **Prompt:** `"Write a Python script that explains what <|im_end|> and <|endoftext|> mean in LLM tokenizers."`
- **Expected Behavior:**
  - The special tokens must appear literally in the output text or code.
  - No trailing tokens appended to the end of the message.
  - No prompt injection or unexpected termination.

---

## 5. UI Controls & Operational Features

- **Duplicate Submission Guard:** The **Send** button and Enter key are disabled while a response is actively generating.
- **In-Flight Cancellation:** Clicking **Cancel** immediately aborts generation on the client and displays a cancellation notice.
- **Retry:** If a timeout or network interruption occurs, the **Retry** button repopulates your last input.
- **Conversation Clear:** Clicking the **Trash** icon resets the session context to start fresh.
- **Max Input Enforcement:** The textarea strictly caps prompts at 4,000 characters.

---

## 6. Bug Reporting & Safe Operational Tracing

Every response and error message generated by Xen includes an immutable **Operational Trace ID** formatted as:

`[Ref: xen-xxxxxxxxxxxx]`

> [!IMPORTANT]
> **Bug Reporting Protocol:**
> When logging an issue in GitHub or Slack:
> 1. Include the exact **Ref ID** (e.g., `Ref: xen-f74a6e970297`).
> 2. Note your tester username and active intent (`TEACHING`, `LAB_TEACHING`).
> 3. State whether the issue is related to **Syntax**, **Pedagogical Quality**, **Latency**, or **UI State**.
> 4. **Do NOT** copy/paste sensitive student or school data into public issue trackers. The Ref ID allows engineering to inspect token telemetry without accessing user PII.

---

## 7. Known Limitations During Team Pilot

1. **Non-Streaming Output:** Responses are generated in full on the GPU and returned in a single batch. Typical generation latency ranges between 4–15 seconds depending on prompt complexity.
2. **Student Gating:** Student portal accounts remain disabled (`HTTP 403 STUDENT_ACCESS_DISABLED`).
3. **Teacher Memory:** Persistent cross-session teacher memory is disabled in v0.1. Conversation context is maintained strictly within the active 10-turn window.
4. **No Server Code Execution:** Code solutions are static and verified via syntax AST parsing only; the server does not execute code.

---

## 8. Rollback & Emergency Deactivation

If any unexpected behavior, runaway generation, or security concern arises during testing:

1. **Immediate API Shutdown:**
   Set `XEN_PILOT_ENABLED=False` in the backend environment and restart the Django service (or worker processes).
2. **Verification:**
   Immediately, all calls to `/api/v1/ai/chat/completions` and `/api/v1/xen/chat` will return `HTTP 403 XEN_PILOT_DISABLED`.
3. **GPU Service Shutdown:**
   Run `docker compose down` inside `pixiumind_serving/` to safely shut down the model container.
