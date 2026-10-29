/** A small binary min-heap used by circuit graph searches. */
export class MinPriorityQueue<T> {
  private items: T[] = []

  constructor(private readonly compare: (a: T, b: T) => number) {}

  get size(): number {
    return this.items.length
  }

  push(value: T): void {
    const items = this.items
    items.push(value)
    let index = items.length - 1
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (this.compare(items[index], items[parent]) >= 0) break
      ;[items[index], items[parent]] = [items[parent], items[index]]
      index = parent
    }
  }

  pop(): T | undefined {
    const items = this.items
    if (items.length === 0) return undefined
    const first = items[0]
    const last = items.pop()!
    if (items.length > 0) {
      items[0] = last
      let index = 0
      while (true) {
        const left = index * 2 + 1
        const right = left + 1
        let smallest = index
        if (left < items.length && this.compare(items[left], items[smallest]) < 0) smallest = left
        if (right < items.length && this.compare(items[right], items[smallest]) < 0) smallest = right
        if (smallest === index) break
        ;[items[index], items[smallest]] = [items[smallest], items[index]]
        index = smallest
      }
    }
    return first
  }
}
