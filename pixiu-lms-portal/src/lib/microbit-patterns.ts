/**
 * BBC micro:bit v2 5x5 LED Matrix Patterns & Font Grids
 */

export const MICROBIT_ICONS: Record<string, boolean[][]> = {
  heart: [
    [false, true, false, true, false],
    [true, true, true, true, true],
    [true, true, true, true, true],
    [false, true, true, true, false],
    [false, false, true, false, false],
  ],
  smile: [
    [false, false, false, false, false],
    [false, true, false, true, false],
    [false, false, false, false, false],
    [true, false, false, false, true],
    [false, true, true, true, false],
  ],
  check: [
    [false, false, false, false, false],
    [false, false, false, false, true],
    [false, false, false, true, false],
    [true, false, true, false, false],
    [false, true, false, false, false],
  ],
  sad: [
    [false, false, false, false, false],
    [false, true, false, true, false],
    [false, false, false, false, false],
    [false, true, true, true, false],
    [true, false, false, false, true],
  ],
  ghost: [
    [false, true, true, true, false],
    [true, true, false, true, true],
    [true, true, true, true, true],
    [true, true, true, true, true],
    [true, false, true, false, true],
  ],
  square: [
    [true, true, true, true, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, true, true, true, true],
  ],
}

export const MICROBIT_DIGITS: boolean[][][] = [
  // 0
  [
    [false, true, true, true, false],
    [false, true, false, true, false],
    [false, true, false, true, false],
    [false, true, false, true, false],
    [false, true, true, true, false],
  ],
  // 1
  [
    [false, false, true, false, false],
    [false, true, true, false, false],
    [false, false, true, false, false],
    [false, false, true, false, false],
    [false, true, true, true, false],
  ],
  // 2
  [
    [false, true, true, true, false],
    [false, false, false, true, false],
    [false, true, true, true, false],
    [false, true, false, false, false],
    [false, true, true, true, false],
  ],
  // 3
  [
    [false, true, true, true, false],
    [false, false, false, true, false],
    [false, true, true, true, false],
    [false, false, false, true, false],
    [false, true, true, true, false],
  ],
  // 4
  [
    [false, true, false, true, false],
    [false, true, false, true, false],
    [false, true, true, true, false],
    [false, false, false, true, false],
    [false, false, false, true, false],
  ],
  // 5
  [
    [false, true, true, true, false],
    [false, true, false, false, false],
    [false, true, true, true, false],
    [false, false, false, true, false],
    [false, true, true, true, false],
  ],
  // 6
  [
    [false, true, true, true, false],
    [false, true, false, false, false],
    [false, true, true, true, false],
    [false, true, false, true, false],
    [false, true, true, true, false],
  ],
  // 7
  [
    [false, true, true, true, false],
    [false, false, false, true, false],
    [false, false, false, true, false],
    [false, false, false, true, false],
    [false, false, false, true, false],
  ],
  // 8
  [
    [false, true, true, true, false],
    [false, true, false, true, false],
    [false, true, true, true, false],
    [false, true, false, true, false],
    [false, true, true, true, false],
  ],
  // 9
  [
    [false, true, true, true, false],
    [false, true, false, true, false],
    [false, true, true, true, false],
    [false, false, false, true, false],
    [false, true, true, true, false],
  ],
]

export function createEmptyMatrix(): boolean[][] {
  return Array.from({ length: 5 }, () => Array(5).fill(false))
}
