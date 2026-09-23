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

export async function startCamera(
  video: HTMLVideoElement,
  options: CameraOptions = {},
): Promise<MediaStream> {
  assertCameraEnvironment()

  const camera = { ...DEFAULT_CAMERA, ...options }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      width: { ideal: camera.width, max: camera.width },
      height: { ideal: camera.height, max: camera.height },
      frameRate: { ideal: camera.frameRate, max: camera.frameRate },
      facingMode: camera.facingMode,
    },
  })

  try {
    video.srcObject = stream
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

export function captureVideoFrame(
  video: HTMLVideoElement,
  maxDimension = 640,
): string | null {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) {
    return null
  }

  const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale))

  const context = canvas.getContext("2d")
  if (!context) return null

  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/jpeg", 0.82)
}
