import test from "node:test"
import assert from "node:assert/strict"
import { getCameraPermissionState, startCamera } from "../../src/lib/ai/camera-session.ts"

test("camera permission reports unsupported outside a browser media environment", async () => {
  assert.equal(await getCameraPermissionState(), "unsupported")
})

test("camera startup rejects cleanly when no browser window exists", async () => {
  await assert.rejects(
    () => startCamera({} as HTMLVideoElement),
    /needs a browser/i,
  )
})
