import type { HandDetection, FingerMask } from "./hand-detector"

export type HandGesture =
  | "fist"
  | "thumbs_up"
  | "thumbs_down"
  | "point"
  | "peace"
  | "rock_on"
  | "ok"
  | "three"
  | "four"
  | "open_palm"
  | "one"
  | "two"

export type HandGestureResult = {
  gesture: HandGesture
  number: number
  confidence: number
  detail: string
  extendedFingers: FingerMask
}

const THUMB = 0
const INDEX = 1
const MIDDLE = 2
const RING = 3
const PINKY = 4

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function thumbVerticalDirection(hand: HandDetection) {
  const mcp = hand.keypoints[2]
  const tip = hand.keypoints[4]
  const wrist = hand.keypoints[0]
  if (!mcp || !tip || !wrist) return "neutral"

  const span = Math.max(1, Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y))
  const delta = tip.y - mcp.y

  if (delta < -span * 0.18) return "up"
  if (delta > span * 0.18) return "down"
  return "neutral"
}

function isOnly(mask: FingerMask, ...indices: number[]) {
  return mask.every((extended, index) =>
    extended === indices.includes(index),
  )
}

export function interpretHandGesture(hand: HandDetection): HandGestureResult {
  const fingers = hand.extendedFingers
  const number = fingers.filter(Boolean).length
  let gesture: HandGesture = number === 0 ? "fist" : number === 5 ? "open_palm" : "one"
  const thumbDirection = thumbVerticalDirection(hand)

  const thumbTip = hand.keypoints[4]
  const indexTip = hand.keypoints[8]
  const wrist = hand.keypoints[0]
  const palmSpan =
    wrist && hand.keypoints[9]
      ? Math.hypot(wrist.x - hand.keypoints[9].x, wrist.y - hand.keypoints[9].y)
      : 100
  const thumbIndexDist =
    thumbTip && indexTip
      ? Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y)
      : 999
  const isOkSign =
    thumbIndexDist < palmSpan * 0.38 && fingers[MIDDLE] && fingers[RING] && fingers[PINKY]

  if (number === 0) {
    gesture = "fist"
  } else if (isOkSign) {
    gesture = "ok"
  } else if (isOnly(fingers, INDEX, PINKY) || (number === 2 && fingers[INDEX] && fingers[PINKY])) {
    gesture = "rock_on"
  } else if (isOnly(fingers, THUMB)) {
    gesture =
      thumbDirection === "up"
        ? "thumbs_up"
        : thumbDirection === "down"
          ? "thumbs_down"
          : "one"
  } else if (isOnly(fingers, INDEX)) {
    gesture = "point"
  } else if (isOnly(fingers, INDEX, MIDDLE)) {
    gesture = "peace"
  } else if (number === 3 && fingers[MIDDLE] && fingers[INDEX] && fingers[RING]) {
    gesture = "three"
  } else if (number === 4 && !fingers[THUMB]) {
    gesture = "four"
  } else if (number === 5) {
    gesture = "open_palm"
  } else if (number === 2) {
    gesture = "two"
  } else if (number === 1) {
    gesture = "one"
  } else if (number === 3) {
    gesture = "three"
  } else if (number === 4) {
    gesture = "four"
  }

  const patternConfidence =
    gesture === "fist" || gesture === "open_palm" || gesture === "peace" || gesture === "rock_on"
      ? 0.96
      : gesture === "point" || gesture === "thumbs_up" || gesture === "thumbs_down" || gesture === "ok"
        ? 0.92
        : 0.85

  const confidence = Math.round(clamp(hand.score * patternConfidence) * 100)
  const detail =
    gesture === "thumbs_up"
      ? "Thumbs up · positive sign"
      : gesture === "thumbs_down"
        ? "Thumbs down"
        : gesture === "open_palm"
          ? "Open palm · 5 fingers"
          : gesture === "peace"
            ? "Peace / Victory sign · 2 fingers"
            : gesture === "rock_on"
              ? "Rock on / Horns sign"
              : gesture === "ok"
                ? "OK sign"
                : gesture === "point"
                  ? "Pointing · index finger"
                  : gesture === "fist"
                    ? "Closed fist · 0 fingers"
                    : `${gesture} · ${number} finger${number === 1 ? "" : "s"}`

  return {
    gesture,
    number,
    confidence,
    detail,
    extendedFingers: fingers,
  }
}

export function interpretHands(hands: HandDetection[]) {
  const primary = hands[0]
  if (!primary) return null
  return interpretHandGesture(primary)
}
