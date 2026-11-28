"""Real-browser Playwright E2E test for Xen Live Circuit Awareness (/simulation).

Architecture exercised:
  Chromium SVG Canvas & CircuitWorkbench -> LiveCircuitContextBridge ->
  Real Vite Dev Proxy -> Real Django Backend -> Real PostgreSQL 17 (XenCyberLabContext & XenJob) ->
  Deterministic Stubbed LLM Worker polling XenWorkerClaimView / XenWorkerCompleteView ->
  Real Chunk Polling & CircuitCopilotChat DOM Rendering.

NOTE: The upstream GPU inference step is deterministically stubbed in this script
via XenWorkerClaimView / XenWorkerCompleteView because no Kaggle GPU worker is
running in this environment. Every frontend/backend API, PostgreSQL persistence,
context sanitization, effective prompt assembly, and chunk delivery step is LIVE.
"""

from __future__ import annotations

import json
import os
import re
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

PORTAL_ORIGIN = os.environ.get("PORTAL_TEST_ORIGIN", "http://127.0.0.1:5175")
DJANGO_ORIGIN = os.environ.get("DJANGO_TEST_ORIGIN", "http://127.0.0.1:8009")
WORKER_SECRET = os.environ.get("XEN_WORKER_SECRET", "local-e2e-worker-secret")
E2E_USERNAME = os.environ.get("E2E_USERNAME", "e2estudent01")
E2E_PASSWORD = os.environ.get("E2E_PASSWORD", "StudentPass!2026")
EVIDENCE_DIR = Path(os.environ.get("XEN_EVIDENCE_DIR", "/tmp/xen-live-evidence"))
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)


def build_deterministic_worker_reply(prompt: str) -> str:
    mission_match = re.search(r"(?:^|\n)\[MISSION CONTEXT\]\s*\n([\s\S]*?)\n\[/MISSION CONTEXT\]", prompt)
    if not mission_match:
        if re.search(r"newton|second law|motion", prompt, re.I):
            return "Newton's second law states that net force equals mass multiplied by acceleration (F = m * a)."
        return "I can help with that concept cleanly without assuming any hardware state."

    raw_ctx = mission_match.group(1).strip()
    user_question = prompt.rsplit("[/MISSION CONTEXT]", 1)[-1].strip()
    try:
        ctx_obj = json.loads(raw_ctx)
    except json.JSONDecodeError:
        ctx_obj = {}

    circuit = ctx_obj.get("circuit") if isinstance(ctx_obj.get("circuit"), dict) else ctx_obj
    board = circuit.get("board")
    parts = circuit.get("parts") or circuit.get("components") or []
    parts_count = circuit.get("parts_count") if isinstance(circuit.get("parts_count"), int) else len(parts)
    wires = circuit.get("wires") or circuit.get("connections") or []
    wires_count = circuit.get("wires_count") if isinstance(circuit.get("wires_count"), int) else len(wires)
    draft = circuit.get("in_progress_connection") or ctx_obj.get("in_progress_connection")

    if not parts_count and not wires_count and not board and not draft:
        return (
            "Your CyberLab canvas is currently empty: board is none, there are 0 placed components, "
            "and 0 completed connections. Health score is not assigned until components are placed."
        )

    if isinstance(draft, dict) and (draft.get("source_pin_id") or draft.get("source")):
        src = draft.get("source") or {}
        cand = draft.get("candidate_target")
        recent = draft.get("recent_target")
        target = cand or recent or {}
        src_pin = draft.get("source_pin_id") or src.get("pin_id") or src.get("pinId") or "unknown"
        tgt_pin = target.get("pin_id") or target.get("pinId")
        is_recent_unhovered = bool(recent and not cand and recent.get("currently_hovered") is False)
        clause = f" from source pin {src_pin}"
        if tgt_pin:
            clause += f" toward {'recent target' if is_recent_unhovered else 'target'} pin {tgt_pin}"
        hover_note = (
            " Your cursor left the pin to type here, so it is recorded as recent_target (currently_hovered=false)."
            if is_recent_unhovered
            else ""
        )
        return (
            f"You are currently drawing an in-progress draft wire{clause}.{hover_note} "
            "It is still a draft wire and is not a completed connection yet."
        )

    wires_json_text = json.dumps(wires).lower()
    issues_json_text = json.dumps(circuit.get("issues") or circuit.get("diagnostics") or []).lower()
    has_anode_wire = "anode" in wires_json_text or "cathode" in issues_json_text
    has_cathode_wire = "cathode" in wires_json_text and not ("not grounded" in issues_json_text or "open" in issues_json_text or "missing return" in issues_json_text)
    if re.search(r"why.*off|not turning on|check|\bled\b", user_question, re.I) and ((has_anode_wire and not has_cathode_wire) or "cathode" in issues_json_text or "gnd" in issues_json_text):
        return (
            "Your completed wires feed the LED Anode (+), "
            "but the LED Cathode (-) still needs a return wire to GND to complete the circuit."
        )

    return f"Observed live circuit from prompt JSON: {parts_count} placed components and {wires_count} completed connections."


class StubbedWorkerController:
    """Polls real Django XenWorkerClaimView / XenWorkerCompleteView with deterministic replies."""

    def __init__(self, captured_jobs: list[dict]) -> None:
        self.captured_jobs = captured_jobs
        self._active = False
        self._stop_event = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)

    def start_loop(self) -> None:
        if not self._thread.is_alive():
            self._thread.start()

    def activate(self) -> None:
        self.start_loop()
        self._active = True

    def stop(self) -> None:
        self._active = False
        self._stop_event.set()
        if self._thread.is_alive():
            self._thread.join(timeout=3)

    def _post_json(self, path: str, body: dict) -> dict | None:
        req = urllib.request.Request(
            f"{DJANGO_ORIGIN}{path}",
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "X-Worker-Secret": WORKER_SECRET,
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            if 200 <= resp.status < 300:
                return json.loads(resp.read().decode("utf-8"))
        return None

    def _run(self) -> None:
        while not self._stop_event.is_set():
            if not self._active:
                time.sleep(0.12)
                continue
            try:
                claim_data = self._post_json(
                    "/api/v1/xen/worker/claim",
                    {
                        "worker_id": "e2e-stub-worker",
                        "metadata": {"mode": "deterministic-playwright-stub"},
                    },
                )
                job = (claim_data or {}).get("job")
                if job and job.get("id"):
                    prompt = job.get("prompt") or ""
                    reply_text = build_deterministic_worker_reply(prompt)
                    self.captured_jobs.append(
                        {
                            "job_id": job["id"],
                            "intent": job.get("intent"),
                            "format_mode": job.get("format_mode"),
                            "prompt": prompt,
                            "reply": reply_text,
                            "claimed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        }
                    )
                    self._post_json(
                        f"/api/v1/xen/worker/jobs/{job['id']}/complete",
                        {
                            "worker_id": "e2e-stub-worker",
                            "text": reply_text,
                            "finish_reason": "stop",
                            "usage": {
                                "prompt_tokens": max(1, len(prompt) // 4),
                                "completion_tokens": max(1, len(reply_text) // 4),
                                "total_tokens": max(2, (len(prompt) + len(reply_text)) // 4),
                            },
                        },
                    )
                    continue
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
                pass
            time.sleep(0.15)


def wait_for(predicate, description: str, timeout_s: float = 10.0, interval_s: float = 0.1, page=None):
    deadline = time.monotonic() + timeout_s
    last_exc: Exception | None = None
    while time.monotonic() < deadline:
        try:
            res = predicate()
            if res:
                return res
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
        if page is not None:
            page.wait_for_timeout(int(interval_s * 1000))
        else:
            time.sleep(interval_s)
    suffix = f" ({last_exc})" if last_exc else ""
    raise AssertionError(f"Timed out after {timeout_s}s waiting for: {description}{suffix}")


def main() -> None:
    context_sync_events: list[dict] = []
    chat_submissions: list[dict] = []
    captured_worker_jobs: list[dict] = []
    page_errors: list[str] = []
    api_errors: list[dict] = []

    worker = StubbedWorkerController(captured_worker_jobs)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"),
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        )
        try:
            context = browser.new_context(viewport={"width": 1440, "height": 900})
            page = context.new_page()

            auth_me_ok = False
            page.on("pageerror", lambda err: page_errors.append(str(err)))

            def on_response(res) -> None:
                nonlocal auth_me_ok
                url = res.url
                if url.endswith("/api/v1/auth/me/") and res.status == 200:
                    auth_me_ok = True
                if "/api/v1/xen/" not in url:
                    return
                method = res.request.method
                status = res.status
                if status >= 400:
                    try:
                        err_text = res.text()
                    except Exception:  # noqa: BLE001
                        err_text = ""
                    api_errors.append({"method": method, "url": url, "status": status, "err_text": err_text})

                if url.endswith("/api/v1/xen/cyberlab/context") and method == "POST":
                    try:
                        req_body = json.loads(res.request.post_data or "null")
                    except Exception:  # noqa: BLE001
                        req_body = None
                    try:
                        res_body = res.json()
                    except Exception:  # noqa: BLE001
                        res_body = None
                    context_sync_events.append({"status": status, "reqBody": req_body, "resBody": res_body})

                if url.endswith("/api/v1/xen/chat") and method == "POST":
                    try:
                        req_body = json.loads(res.request.post_data or "null")
                    except Exception:  # noqa: BLE001
                        req_body = None
                    try:
                        res_body = res.json()
                    except Exception:  # noqa: BLE001
                        res_body = None
                    chat_submissions.append({"status": status, "reqBody": req_body, "resBody": res_body})

            page.on("response", on_response)

            # 0. Real Django Auth -> /simulation
            page.goto(f"{PORTAL_ORIGIN}/login", wait_until="domcontentloaded")
            login_res = page.evaluate(
                """async ({ username, password }) => {
                    const csrfRes = await fetch("/api/v1/auth/csrf/", { credentials: "include" });
                    const csrfData = await csrfRes.json().catch(() => ({}));
                    const match = document.cookie.match(/(?:^|;\\s*)pixiu_csrf=([^;]+)/);
                    const csrfToken = csrfData?.csrfToken || (match ? decodeURIComponent(match[1]) : "");
                    const res = await fetch("/api/v1/auth/login/", {
                        method: "POST",
                        credentials: "include",
                        headers: {
                            "Content-Type": "application/json",
                            "X-CSRFToken": csrfToken,
                        },
                        body: JSON.stringify({ username, password, role: "student" }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok) {
                        window.sessionStorage.setItem("pixiu_session_role", "student");
                    }
                    return { ok: res.ok, status: res.status, data };
                }""",
                {"username": E2E_USERNAME, "password": E2E_PASSWORD},
            )
            assert login_res["ok"], f"Real Django login failed: {login_res}"

            wait_ui = lambda pred, desc, timeout_s=10.0: wait_for(pred, desc, timeout_s=timeout_s, page=page)

            page.goto(f"{PORTAL_ORIGIN}/simulation", wait_until="domcontentloaded")
            open_xen_btn = page.get_by_role("button", name="Open Xen AI Circuit Copilot")
            open_xen_btn.wait_for(state="visible", timeout=15000)
            wait_ui(lambda: auth_me_ok, "AuthContext /api/v1/auth/me/ 200 OK", timeout_s=10.0)

            close_welcome_btn = page.get_by_role("button", name="Close lab home")
            if close_welcome_btn.is_visible():
                close_welcome_btn.click()
                close_welcome_btn.wait_for(state="hidden", timeout=5000)

            pill_text = open_xen_btn.inner_text()
            assert "Empty" in pill_text, f"Expected Empty badge on fresh canvas, got: {pill_text!r}"
            assert "100%" not in pill_text, f"Empty canvas must not display 100%: {pill_text!r}"

            panel = page.locator('[aria-label="Xen Circuit Copilot Panel"]')
            chat_input = page.locator(
                'input[placeholder*="Ask about this circuit"], textarea[placeholder*="Ask about this circuit"]'
            ).first
            send_btn = page.get_by_role("button", name="Send message")
            busy_btn = panel.get_by_role("button", name="LED check karo (Hinglish)")
            assistant_bubbles = panel.locator("div.items-start > div")

            def ask_xen(query_text: str, expect_fallback: bool = False) -> str:
                before_count = assistant_bubbles.count()
                chat_input.click()
                chat_input.fill(query_text)
                send_btn.click()

                def _done():
                    if assistant_bubbles.count() <= before_count:
                        return False
                    if busy_btn.is_disabled():
                        return False
                    last_text = assistant_bubbles.last.inner_text().strip()
                    if not last_text or last_text == "...":
                        return False
                    if expect_fallback and "xen model is unavailable" not in last_text.lower():
                        return False
                    return last_text

                return wait_ui(_done, f"Xen reply for {query_text!r}", timeout_s=15.0 if expect_fallback else 12.0)

            def quick_add_part(exact_name: str) -> None:
                search_box = page.locator('input[placeholder*="Search parts"]').first
                search_box.fill(exact_name)
                btn = (
                    page.locator("aside button")
                    .filter(has=page.locator("span.font-bold", has_text=re.compile(f"^{re.escape(exact_name)}$")))
                    .first
                )
                btn.wait_for(state="visible", timeout=5000)
                btn.click()
                search_box.fill("")
                page.wait_for_timeout(120)

            def get_pin_coords(title_text: str) -> dict:
                coords = page.evaluate(
                    """(targetTitle) => {
                        const titles = Array.from(document.querySelectorAll("svg circle title"));
                        const match = titles.find((el) => (el.textContent || "").trim() === targetTitle);
                        if (!match || !match.parentElement) return null;
                        const rect = match.parentElement.getBoundingClientRect();
                        const x = rect.left + rect.width / 2;
                        const y = rect.top + rect.height / 2;
                        const topEl = document.elementFromPoint(x, y);
                        return {
                            x,
                            y,
                            coveredByChat: Boolean(topEl?.closest('[aria-label="Xen Circuit Copilot Panel"]')),
                        };
                    }""",
                    title_text,
                )
                assert coords is not None, f"Pin {title_text!r} not found on SVG"
                return coords

            def ensure_pins_uncovered() -> None:
                target_pins = [
                    "Arduino Uno · D13",
                    "Arduino Uno · GND",
                    "Resistor · Terminal 1",
                    "Resistor · Terminal 2",
                    "LED · Anode (+)",
                    "LED · Cathode (-)",
                ]
                for _ in range(4):
                    coords_list = [get_pin_coords(p) for p in target_pins]
                    if not any(c["coveredByChat"] for c in coords_list):
                        return
                    was_panel_open = panel.is_visible()
                    if was_panel_open:
                        page.get_by_role("button", name="Minimize Xen Window").click()
                        panel.wait_for(state="hidden", timeout=3000)
                    page.get_by_role("button", name="Zoom out").click()
                    page.wait_for_timeout(120)
                    svg = page.locator("svg").filter(has=page.locator("circle title")).first
                    svg_box = svg.bounding_box()
                    if svg_box:
                        y_band = svg_box["y"] + 24
                        page.mouse.move(svg_box["x"] + 340, y_band)
                        page.mouse.down()
                        page.mouse.move(svg_box["x"] + 160, y_band, steps=6)
                        page.mouse.up()
                        page.wait_for_timeout(120)
                    if was_panel_open:
                        page.get_by_role("button", name="Expand Xen Window").click()
                        panel.wait_for(state="visible", timeout=3000)

            def click_pin(title_text: str) -> None:
                c = get_pin_coords(title_text)
                assert not c["coveredByChat"], f"Pin {title_text!r} is covered by Xen panel at {c}"
                page.mouse.move(c["x"], c["y"], steps=4)
                page.mouse.down()
                page.mouse.up()

            def hover_pin(title_text: str) -> None:
                c = get_pin_coords(title_text)
                assert not c["coveredByChat"], f"Pin {title_text!r} is covered by Xen panel at {c}"
                page.mouse.move(c["x"], c["y"], steps=6)

            def rendered_wire_count() -> int:
                return page.evaluate(
                    """() => Array.from(document.querySelectorAll("svg g.group path title"))
                        .filter((t) => (t.textContent || "").includes("Click to select wire")).length"""
                )

            def draft_wire_count() -> int:
                return page.evaluate("""() => document.querySelectorAll('svg path[stroke-dasharray="6 5"]').length""")

            # 1. Empty Canvas + Offline Worker Fallback
            open_xen_btn.click()
            panel.wait_for(state="visible")
            panel.locator("span", has_text=re.compile(r"^Empty$")).first.wait_for(state="visible")

            offline_reply = ask_xen("What board and components are on my canvas right now?", expect_fallback=True)
            assert re.search(r"Xen model is unavailable", offline_reply, re.I), offline_reply
            assert not re.search(r"100/100|arduino-uno|connections are intact", offline_reply, re.I), offline_reply
            page.screenshot(path=str(EVIDENCE_DIR / "01-empty-offline.png"))

            # 2. Activate Deterministic Stubbed Worker -> Empty Canvas Live Prompt
            worker.activate()
            jobs_before = len(captured_worker_jobs)
            empty_online_reply = ask_xen("What components and board are currently placed on my canvas?")
            assert len(captured_worker_jobs) > jobs_before
            empty_prompt = captured_worker_jobs[-1]["prompt"]
            assert "arduino-uno" not in empty_prompt.lower(), empty_prompt
            assert "100/100" not in empty_online_reply
            assert re.search(r"empty|0 placed components|board is none", empty_online_reply, re.I), empty_online_reply
            page.screenshot(path=str(EVIDENCE_DIR / "02-empty-online.png"))

            # 3. Place Arduino Uno, Resistor, LED via Palette & verify workspace controls
            page.get_by_role("button", name="Minimize Xen Window").click()
            quick_add_part("Arduino Uno")
            quick_add_part("Resistor")
            quick_add_part("LED")
            page.get_by_role("button", name="Fit to Screen").click()
            page.wait_for_timeout(200)

            page.get_by_role("button", name="Expand Xen Window").click()
            panel.wait_for(state="visible")
            ensure_pins_uncovered()

            # 4. Wire Start -> Target Hover Enter -> Leave to Chat Input -> Ask -> Cancel
            idx_before_start = len(context_sync_events)
            click_pin("Arduino Uno · D13")
            d13_pos = get_pin_coords("Arduino Uno · D13")
            page.mouse.move(d13_pos["x"] + 25, d13_pos["y"] - 20, steps=3)
            assert draft_wire_count() == 1, "Expected dashed draft wire after pin start"

            start_sync = wait_ui(
                lambda: next(
                    (
                        e
                        for e in context_sync_events[idx_before_start:]
                        if (e.get("reqBody") or {}).get("event_type") == "wire_start"
                    ),
                    None,
                ),
                "wire_start sync event",
            )
            assert start_sync["status"] == 200
            assert len(start_sync["reqBody"]["context_envelope"]["components"]) == 3
            assert start_sync["reqBody"]["context_envelope"]["in_progress_connection"]["source_pin_id"] == "d13"

            idx_before_hover = len(context_sync_events)
            # Route above the board/resistor so intermediate pins are not brushed before landing on LED Anode (+)
            anode_pos = get_pin_coords("LED · Anode (+)")
            assert not anode_pos["coveredByChat"]
            page.mouse.move(d13_pos["x"] + 25, d13_pos["y"] - 80, steps=3)
            page.mouse.move(anode_pos["x"], anode_pos["y"] - 80, steps=4)
            page.mouse.move(anode_pos["x"], anode_pos["y"], steps=4)
            page.screenshot(path=str(EVIDENCE_DIR / "03-target-hover-enter.png"))

            hover_enter_sync = wait_ui(
                lambda: next(
                    (
                        e
                        for e in context_sync_events[idx_before_hover:]
                        if (e.get("reqBody") or {}).get("event_type") == "target_hover_enter"
                        and (((((e.get("reqBody") or {}).get("context_envelope") or {}).get("in_progress_connection") or {}).get("candidate_target") or {}).get("pin_id") == "anode")
                    ),
                    None,
                ),
                "target_hover_enter sync event for LED anode",
            )
            assert hover_enter_sync["status"] == 200
            assert hover_enter_sync["reqBody"]["context_envelope"]["in_progress_connection"]["candidate_target"]["pin_id"] == "anode"
            assert (
                hover_enter_sync["reqBody"]["context_envelope"]["in_progress_connection"]["candidate_target"]["currently_hovered"]
                is True
            )

            # Move cursor downward off LED Anode (+) cleanly (not brushing Cathode) into Xen chat input box
            idx_before_leave = len(context_sync_events)
            chat_rect = chat_input.bounding_box()
            assert chat_rect is not None
            page.mouse.move(anode_pos["x"], anode_pos["y"] + 40, steps=4)
            page.mouse.move(chat_rect["x"] + chat_rect["width"] / 2, chat_rect["y"] + chat_rect["height"] / 2, steps=8)
            chat_input.click()

            hover_leave_sync = wait_ui(
                lambda: next(
                    (
                        e
                        for e in context_sync_events[idx_before_leave:]
                        if (e.get("reqBody") or {}).get("event_type") == "target_hover_leave"
                        and (((((e.get("reqBody") or {}).get("context_envelope") or {}).get("in_progress_connection") or {}).get("recent_target") or {}).get("pin_id") == "anode")
                    ),
                    None,
                ),
                "target_hover_leave sync event for LED anode",
            )
            assert hover_leave_sync["status"] == 200
            assert hover_leave_sync["reqBody"]["context_envelope"]["in_progress_connection"]["candidate_target"] is None
            assert hover_leave_sync["reqBody"]["context_envelope"]["in_progress_connection"]["recent_target"]["pin_id"] == "anode"
            assert (
                hover_leave_sync["reqBody"]["context_envelope"]["in_progress_connection"]["recent_target"]["currently_hovered"]
                is False
            )

            draft_reply = ask_xen("What am I connecting right now?")
            draft_prompt = captured_worker_jobs[-1]["prompt"]
            assert re.search(r"d13", draft_prompt, re.I), draft_prompt
            assert re.search(r"anode", draft_prompt, re.I), draft_prompt
            assert re.search(r"recent_target|no longer hovered|not currently hovered|currently_hovered\":\s*false", draft_prompt, re.I), draft_prompt
            assert re.search(r"d13", draft_reply, re.I)
            assert re.search(r"draft", draft_reply, re.I)
            page.screenshot(path=str(EVIDENCE_DIR / "04-hover-leave-query.png"))

            # Cancel active draft wire with Escape
            idx_before_cancel = len(context_sync_events)
            chat_input.evaluate("el => el.blur()")
            page.keyboard.press("Escape")
            wait_ui(lambda: draft_wire_count() == 0, "draft wire disappears after Escape")

            cancel_sync = wait_ui(
                lambda: next(
                    (
                        e
                        for e in context_sync_events[idx_before_cancel:]
                        if (e.get("reqBody") or {}).get("event_type") == "wire_cancel"
                    ),
                    None,
                ),
                "wire_cancel sync event",
            )
            assert cancel_sync["status"] == 200
            assert cancel_sync["reqBody"]["context_envelope"]["in_progress_connection"] is None

            # 5. Complete 2 wires, Ask Diagnostics, Reject Duplicate, Complete 3rd wire
            click_pin("Arduino Uno · D13")
            click_pin("Resistor · Terminal 1")
            wait_ui(lambda: rendered_wire_count() == 1, "1st completed wire rendered")

            click_pin("Resistor · Terminal 2")
            click_pin("LED · Anode (+)")
            wait_ui(lambda: rendered_wire_count() == 2, "2nd completed wire rendered")

            cathode_reply = ask_xen("Why is my LED off?")
            assert re.search(r"cathode|gnd|return", cathode_reply, re.I), cathode_reply

            # Duplicate wire check
            click_pin("Arduino Uno · D13")
            click_pin("Resistor · Terminal 1")
            page.wait_for_timeout(250)
            assert rendered_wire_count() == 2, "Duplicate wire must NOT add a 3rd wire"
            if draft_wire_count() > 0:
                page.keyboard.press("Escape")
                wait_ui(lambda: draft_wire_count() == 0, "cancel lingering duplicate attempt")

            # Complete 3rd wire
            click_pin("LED · Cathode (-)")
            click_pin("Arduino Uno · GND")
            wait_ui(lambda: rendered_wire_count() == 3, "3rd completed wire rendered")
            wait_ui(
                lambda: any(
                    (e.get("reqBody") or {}).get("event_type") == "wire_complete"
                    and len(((e.get("reqBody") or {}).get("context_envelope") or {}).get("connections") or []) == 3
                    for e in context_sync_events
                ),
                "3 completed wires synced",
            )
            page.screenshot(path=str(EVIDENCE_DIR / "05-complete-circuit.png"))

            # 6. Wire Deletion
            chat_input.evaluate("el => el.blur()")
            idx_before_delete = len(context_sync_events)
            wire_mid = page.evaluate(
                """() => {
                    const titles = Array.from(document.querySelectorAll("svg g.group path title"))
                        .filter((t) => (t.textContent || "").includes("Click to select wire"));
                    for (const t of titles.slice().reverse()) {
                        const hitPath = t.parentElement;
                        if (!hitPath || typeof hitPath.getPointAtLength !== "function") continue;
                        const svg = hitPath.ownerSVGElement;
                        const ctm = hitPath.getScreenCTM();
                        if (!svg || !ctm) continue;
                        const total = hitPath.getTotalLength();
                        for (const frac of [0.5, 0.35, 0.65, 0.25, 0.75]) {
                            const pt = hitPath.getPointAtLength(total * frac);
                            const p = svg.createSVGPoint();
                            p.x = pt.x;
                            p.y = pt.y;
                            const sp = p.matrixTransform(ctm);
                            const el = document.elementFromPoint(sp.x, sp.y);
                            if (el && el.tagName.toLowerCase() === "path") {
                                return { x: sp.x, y: sp.y };
                            }
                        }
                    }
                    return null;
                }"""
            )
            assert wire_mid is not None, "Clickable unobstructed wire point not found"
            page.mouse.move(wire_mid["x"], wire_mid["y"], steps=3)
            page.mouse.down()
            page.mouse.up()
            page.locator('button[title="Delete this wire"]').wait_for(state="visible", timeout=5000)
            page.keyboard.press("Delete")
            wait_ui(lambda: rendered_wire_count() == 2, "wire deleted down to 2")

            delete_sync = wait_ui(
                lambda: next(
                    (
                        e
                        for e in context_sync_events[idx_before_delete:]
                        if (e.get("reqBody") or {}).get("event_type") == "wire_delete"
                    ),
                    None,
                ),
                "wire_delete sync event",
            )
            assert delete_sync["status"] == 200
            assert len(delete_sync["reqBody"]["context_envelope"]["connections"]) == 2

            # 7. Simulation Running + Physics Query Context Isolation
            run_btn = page.locator('button[title*="Launch Pixiu runtime"]')
            run_btn.click()
            page.locator('button[title*="Stop Pixiu runtime"]').wait_for(state="visible", timeout=5000)

            chat_before_physics = len(chat_submissions)
            jobs_before_physics = len(captured_worker_jobs)
            physics_reply = ask_xen("Explain Newton's second law of motion.")
            assert len(chat_submissions) == chat_before_physics + 1
            assert chat_submissions[-1]["reqBody"].get("context_envelope") is None
            assert len(captured_worker_jobs) == jobs_before_physics + 1
            physics_prompt = captured_worker_jobs[-1]["prompt"]
            assert "[MISSION CONTEXT]" not in physics_prompt, physics_prompt
            assert re.search(r"F = m \* a|mass multiplied by acceleration", physics_reply, re.I)

            page.locator('button[title*="Stop Pixiu runtime"]').click()
            run_btn.wait_for(state="visible", timeout=5000)
            page.screenshot(path=str(EVIDENCE_DIR / "06-physics-isolation.png"))

            # 8. Clear Canvas / Session Reset Isolation
            session_before_reset = context_sync_events[-1]["reqBody"]["session_id"]
            idx_before_reset = len(context_sync_events)

            page.locator('button[title="Open Pixiu lab tools"]').click()
            page.get_by_role("menuitem", name=re.compile(r"Clear canvas", re.I)).click()

            reset_sync = wait_ui(
                lambda: next(
                    (
                        e
                        for e in context_sync_events[idx_before_reset:]
                        if (e.get("reqBody") or {}).get("event_type") == "session_reset"
                    ),
                    None,
                ),
                "session_reset sync event",
            )
            assert reset_sync["status"] == 200
            assert reset_sync["reqBody"]["session_id"] != session_before_reset
            assert reset_sync["reqBody"]["circuit_revision"] == 0
            assert len(reset_sync["reqBody"]["context_envelope"]["components"]) == 0
            assert len(reset_sync["reqBody"]["context_envelope"]["connections"]) == 0

            post_reset_reply = ask_xen("What components are on my canvas right now?")
            post_reset_prompt = captured_worker_jobs[-1]["prompt"]
            assert "arduino-uno" not in post_reset_prompt.lower(), post_reset_prompt
            assert re.search(r"empty|0 placed components|board is none", post_reset_reply, re.I), post_reset_reply
            page.screenshot(path=str(EVIDENCE_DIR / "07-session-reset.png"))

            assert not page_errors, f"Unexpected page errors: {page_errors}"
            assert not api_errors, f"Unexpected Xen API errors: {api_errors}"

            trace_summary = {
                "worker_mode": "stubbed_upstream_worker (real XenWorkerClaimView + XenWorkerCompleteView + PostgreSQL 17)",
                "portal_origin": PORTAL_ORIGIN,
                "django_origin": DJANGO_ORIGIN,
                "captured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "sync_events_count": len(context_sync_events),
                "sync_events_summary": [
                    {
                        "status": e["status"],
                        "event_type": (e.get("reqBody") or {}).get("event_type"),
                        "session_id": (e.get("reqBody") or {}).get("session_id"),
                        "circuit_revision": (e.get("reqBody") or {}).get("circuit_revision"),
                        "interaction_revision": (e.get("reqBody") or {}).get("interaction_revision"),
                        "event_seq": (e.get("reqBody") or {}).get("event_seq"),
                        "components": len(((e.get("reqBody") or {}).get("context_envelope") or {}).get("components") or []),
                        "connections": len(((e.get("reqBody") or {}).get("context_envelope") or {}).get("connections") or []),
                        "draft": (
                            {
                                "source_pin_id": ((e.get("reqBody") or {}).get("context_envelope") or {}).get("in_progress_connection", {}).get("source_pin_id"),
                                "candidate_target": ((e.get("reqBody") or {}).get("context_envelope") or {})
                                .get("in_progress_connection", {})
                                .get("candidate_target"),
                                "recent_target": ((e.get("reqBody") or {}).get("context_envelope") or {})
                                .get("in_progress_connection", {})
                                .get("recent_target"),
                            }
                            if ((e.get("reqBody") or {}).get("context_envelope") or {}).get("in_progress_connection")
                            else None
                        ),
                    }
                    for e in context_sync_events
                ],
                "chat_submissions_count": len(chat_submissions),
                "worker_jobs": captured_worker_jobs,
            }
            (EVIDENCE_DIR / "e2e-trace.json").write_text(json.dumps(trace_summary, indent=2), encoding="utf-8")

            print(
                f"PASS live-circuit-awareness.browser.py: "
                f"{len(context_sync_events)} context sync events, "
                f"{len(chat_submissions)} chat submissions, "
                f"{len(captured_worker_jobs)} stubbed-worker jobs"
            )
        finally:
            worker.stop()
            browser.close()


if __name__ == "__main__":
    main()
