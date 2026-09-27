export type CameraOptions = {
  width?: number
  height?: number
  frameRate?: number
  facingMode?: "user" | "environment"
}

const DEFAULT_CAMERA: Required<CameraOptions> = {
  width: 640,
  height: 480,
  frameRate: 15,
  facingMode: "user",
}

function assertCameraEnvironment() {
  if (typeof window === "undefined") {
    throw new Error("PIXIU AI Studio needs a browser.")
  }

  const secure =
    window.isSecureContext ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"

  if (!secure) {
    throw new Error("Camera access requires HTTPS (or localhost).")
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not support camera access.")
  }
}

export type MediaPermissionState = "granted" | "denied" | "prompt" | "unsupported" | "unknown"

export async function getCameraPermissionState(): Promise<MediaPermissionState> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "unsupported"
  }

  try {
    const permissions = navigator.permissions
    if (!permissions?.query) return "unknown"
    const result = await permissions.query({
      name: "camera" as PermissionName,
    })
    return result.state
  } catch {
    return "unknown"
  }
}

export async function startCamera(
  video: HTMLVideoElement,
  options: CameraOptions = {},
): Promise<MediaStream> {
  assertCameraEnvironment()

  const camera = { ...DEFAULT_CAMERA, ...options }
  let stream: MediaStream

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: { ideal: camera.width, max: camera.width },
        height: { ideal: camera.height, max: camera.height },
        frameRate: { ideal: camera.frameRate, max: camera.frameRate },
        facingMode: camera.facingMode,
      },
    })
  } catch (error) {
    const name =
      error && typeof error === "object" && "name" in error
        ? String((error as { name?: unknown }).name ?? "")
        : ""

    // Some mobile/older browsers reject a constrained request even though a
    // camera exists. Retry once with a minimal video request before surfacing
    // the error to the UI.
    if (name !== "OverconstrainedError") throw error

    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: true,
    })
  }

  try {
    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    await waitForVideoReady(video)
    await video.play()
    return stream
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop())
    throw error instanceof Error ? error : new Error("Camera could not be started.")
  }
}

export function stopCamera(video: HTMLVideoElement | null, stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
  if (video) {
    video.pause()
    video.srcObject = null
  }
  disposeCaptureFrameResource()
}

export function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("Camera started, but no video frames became available.")),
      8000,
    )

    const cleanup = () => {
      window.clearTimeout(timeout)
      video.removeEventListener("loadedmetadata", onReady)
      video.removeEventListener("loadeddata", onReady)
      video.removeEventListener("error", onError)
    }

    const onReady = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        cleanup()
        resolve()
      }
    }

    const onError = () => {
      cleanup()
      reject(new Error("The camera video stream could not be read."))
    }

    video.addEventListener("loadedmetadata", onReady)
    video.addEventListener("loadeddata", onReady)
    video.addEventListener("error", onError)
  })
}

type CaptureResource = {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  width: number
  height: number
}

let captureResource: CaptureResource | null = null

function getCaptureResource(width: number, height: number): CaptureResource | null {
  if (typeof document === "undefined") return null

  if (
    !captureResource ||
    captureResource.width !== width ||
    captureResource.height !== height
  ) {
    const canvas = captureResource?.canvas ?? document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext("2d")
    if (!context) {
      captureResource = null
      return null
    }

    captureResource = {
      canvas,
      context,
      width,
      height,
    }
  }

  return captureResource
}

export function captureVideoFrame(
  video: HTMLVideoElement,
  maxDimension = 640,
): string | null {
  if (
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
    !video.videoWidth ||
    !video.videoHeight
  ) {
    return null
  }

  const requestedDimension = Number(maxDimension)
  const safeMaxDimension = Number.isFinite(requestedDimension)
    ? Math.max(1, Math.floor(requestedDimension))
    : 640
  const scale = Math.min(
    1,
    safeMaxDimension / Math.max(video.videoWidth, video.videoHeight),
  )
  const width = Math.max(1, Math.round(video.videoWidth * scale))
  const height = Math.max(1, Math.round(video.videoHeight * scale))
  const resource = getCaptureResource(width, height)
  if (!resource) return null

  resource.context.drawImage(video, 0, 0, width, height)
  return resource.canvas.toDataURL("image/jpeg", 0.82)
}

export function disposeCaptureFrameResource() {
  if (!captureResource) return
  captureResource.canvas.width = 1
  captureResource.canvas.height = 1
  captureResource = null
}
