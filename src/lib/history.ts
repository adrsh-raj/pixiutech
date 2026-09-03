export interface HistoryState<T> {
  past: T[]
  present: T
  future: T[]
}

const MAX_HISTORY = 50

/**
 * Creates a new history state with the initial value.
 */
export function createHistory<T>(initial: T): HistoryState<T> {
  return {
    past: [],
    present: initial,
    future: []
  }
}

/**
 * Pushes a new state onto the history stack, clearing the future.
 */
export function pushState<T>(history: HistoryState<T>, state: T): HistoryState<T> {
  const newPast = [...history.past, history.present]
  if (newPast.length > MAX_HISTORY) {
    newPast.shift() // Trim oldest when exceeded
  }
  return {
    past: newPast,
    present: state,
    future: []
  }
}

/**
 * Reverts the state to the previous one in the past stack.
 */
export function undo<T>(history: HistoryState<T>): HistoryState<T> {
  if (!canUndo(history)) return history

  const previous = history.past[history.past.length - 1]
  const newPast = history.past.slice(0, history.past.length - 1)

  return {
    past: newPast,
    present: previous,
    future: [history.present, ...history.future]
  }
}

/**
 * Advances the state to the next one in the future stack.
 */
export function redo<T>(history: HistoryState<T>): HistoryState<T> {
  if (!canRedo(history)) return history

  const next = history.future[0]
  const newFuture = history.future.slice(1)

  return {
    past: [...history.past, history.present],
    present: next,
    future: newFuture
  }
}

/**
 * Checks if an undo operation is possible.
 */
export function canUndo<T>(history: HistoryState<T>): boolean {
  return history.past.length > 0
}

/**
 * Checks if a redo operation is possible.
 */
export function canRedo<T>(history: HistoryState<T>): boolean {
  return history.future.length > 0
}
