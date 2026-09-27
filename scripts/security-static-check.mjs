#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => readFileSync(join(root, p), "utf8")
const failures = []
const assert = (condition, message) => { if (!condition) failures.push(message) }

const settings = read("pixiu-backend/config/settings.py")
const quizSerializers = read("pixiu-backend/learning/serializers.py")
const learningViews = read("pixiu-backend/learning/views.py")
const playback = read("pixiu-backend/core/learning_content_files.py")
const hand = read("pixiu-lms-portal/src/lib/ai/hand-detector.ts")
const face = read("pixiu-lms-portal/src/lib/ai/face-detector.ts")
const rootVercel = read("vercel.json")
const portalVercel = read("pixiu-lms-portal/vercel.json")

assert(settings.includes('SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")'), "Render TLS proxy header is not explicitly configured")
assert(settings.includes('if not DEBUG and CLOUDFLARE_TURNSTILE_ENABLED and not CLOUDFLARE_TURNSTILE_SECRET_KEY:'), "Production Turnstile is not fail-closed when its secret is missing")
assert(settings.includes('os.environ.get("PIXIU_BILLING_ACCOUNT_NUMBER", os.environ.get("PIXIU_BANK_ACCOUNT_NUMBER", ""))'), "Billing account fallback is not secret-free")
assert(!/PIXIU_BILLING_ACCOUNT_NUMBER[^\n]*[0-9]{6,}/.test(settings), "Billing account number has a source-code numeric fallback")
assert(!/PIXIU_BILLING_IFSC[^\n]*[A-Z0-9]{8,}/.test(settings), "Billing IFSC has a source-code value")
assert(hand.includes("@mediapipe/hands@0.4.1675469240/hands.js"), "MediaPipe Hands script is not version pinned")
assert(hand.includes("@mediapipe/hands@0.4.1675469240/"), "MediaPipe Hands assets are not version pinned")
assert(face.includes("@mediapipe/face_mesh@0.4.1633559619/face_mesh.js"), "MediaPipe FaceMesh script is not version pinned")
assert(face.includes("@mediapipe/face_mesh@0.4.1633559619/"), "MediaPipe FaceMesh assets are not version pinned")
assert(quizSerializers.includes('if not accessible_quizzes(request.user).filter(pk=quiz.pk).exists()'), "Quiz question writes are missing accessible-quiz scope validation")
assert(quizSerializers.includes('accessible_curriculum"]).accessible_curriculum(user).filter(pk=unit.pk)'), "Curriculum assignment writes are missing source scope validation")
assert(quizSerializers.includes('accessible_content"]).accessible_content(user).filter(pk=content.pk)'), "Content assignment writes are missing source scope validation")
assert(quizSerializers.includes('if not accessible_projects(request.user).filter(pk=project.pk).exists()'), "Project evidence writes are missing project scope validation")
assert(quizSerializers.includes('Session cannot be changed after activity creation.'), "Session activity moves are not locked to the original scoped session")
assert(learningViews.includes("self.role_only(UserRole.ADMIN, UserRole.STUDENT)"), "Quiz attempt submission is not restricted to learner/admin roles")
assert(playback.includes('status=UserStatus.ACTIVE'), "Signed video playback does not reject suspended accounts")
for (const file of [rootVercel, portalVercel]) {
  for (const header of [
    '"Strict-Transport-Security"',
    '"X-Content-Type-Options"',
    '"X-Frame-Options"',
    '"Referrer-Policy"',
    '"Permissions-Policy"',
  ]) assert(file.includes(header), "Vercel security header missing: " + header)
}

const workflows = readdirSync(join(root, ".github/workflows"))
  .filter((name) => /\.(yml|yaml)$/.test(name))
for (const name of workflows) {
  const source = read(".github/workflows/" + name)
  const refs = [...source.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gm)].map((m) => m[1])
  for (const ref of refs) {
    if (ref.startsWith("actions/")) {
      const sha = ref.split("@")[1] || ""
      assert(/^[0-9a-f]{40}$/i.test(sha), name + ": action is not pinned to a full commit SHA: " + ref)
    }
  }
}

if (failures.length) {
  console.error("PIXIU security static gate FAILED")
  for (const failure of failures) console.error(" - " + failure)
  process.exit(1)
}

console.log("PIXIU security static gate PASSED")
console.log("Secrets/defaults · TLS proxy · MediaPipe pinning · scoped writes · CI action pinning · response headers: PASS")
