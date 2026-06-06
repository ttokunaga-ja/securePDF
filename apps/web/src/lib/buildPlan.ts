import type { Operation, OperationPlan } from '@securepdf/schema'

export interface PageSlot {
  fileId: string
  /** 0-based page index within its source file. */
  pageIndex: number
  /** Rotation delta in degrees: 0 | 90 | 180 | 270. */
  rotation: number
  /** Whether the page should be mirrored horizontally. */
  flipped: boolean
}

export interface PlanFile {
  id: string
  filename: string
  pageCount: number
}

/**
 * Translate the GUI's arranged page list into an operation plan:
 *   merge(all files) → reorder(to the arrangement) → delete(removed) → rotate(groups) → flip(group)
 *
 * After merging in file order, pages are numbered 1..N. `reorder` places the kept
 * pages in the user's order (deleted pages pushed to the tail), `delete` trims the
 * tail, and `rotate` applies the per-page deltas by final position.
 */
export function buildPlan(slots: PageSlot[], files: PlanFile[]): OperationPlan {
  const offset = new Map<string, number>()
  let total = 0
  for (const file of files) {
    offset.set(file.id, total)
    total += file.pageCount
  }

  const mergedIndex = (slot: PageSlot) => (offset.get(slot.fileId) ?? 0) + slot.pageIndex + 1
  const kept = slots.map(mergedIndex)
  const keptSet = new Set(kept)
  const deleted: number[] = []
  for (let page = 1; page <= total; page++) if (!keptSet.has(page)) deleted.push(page)

  const operations: Operation[] = [{ op: 'merge', inputs: files.map((file) => file.id) }]

  const orderUnchanged = deleted.length === 0 && kept.every((page, i) => page === i + 1)
  if (!orderUnchanged) {
    operations.push({ op: 'reorder', order: [...kept, ...deleted] })
    if (deleted.length > 0) {
      operations.push({ op: 'delete', pages: `${kept.length + 1}-${total}` })
    }
  }

  const groups = new Map<90 | 180 | 270, number[]>()
  slots.forEach((slot, i) => {
    const rotation = (((slot.rotation % 360) + 360) % 360) as 0 | 90 | 180 | 270
    if (rotation !== 0) {
      const list = groups.get(rotation) ?? []
      list.push(i + 1)
      groups.set(rotation, list)
    }
  })
  for (const [degrees, positions] of groups) {
    operations.push({ op: 'rotate', pages: positions.join(','), degrees })
  }

  const flipped = slots
    .map((slot, i) => (slot.flipped ? i + 1 : null))
    .filter((position): position is number => position !== null)
  if (flipped.length > 0) {
    operations.push({ op: 'flip', pages: flipped.join(','), axis: 'horizontal' })
  }

  return {
    version: '1',
    inputs: files.map((file) => ({
      id: file.id,
      filename: file.filename,
      pageCount: file.pageCount,
    })),
    operations,
    output: { format: 'pdf', filename: 'securepdf-output.pdf' },
  }
}
