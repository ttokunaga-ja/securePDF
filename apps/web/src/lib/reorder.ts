// The rail is one dnd-kit sortable list mixing page cards with a single insert
// slot (where newly imported files land). Both move with the same gesture, so a
// drag is resolved against the *combined* id list and split back into the new
// page order plus the slot's new position. This keeps pages and the slot on one
// code path instead of two drag systems.

/** Stable sortable id for the (single) insert slot among the page ids. */
export const INSERT_SLOT_ID = '__insert-slot__'

export interface RailReorder {
  /** Page keys in their new order (the slot id removed). */
  order: string[]
  /** New insert index = number of pages before the slot. */
  insertIndex: number
}

/** Resolve a dnd-kit drop within the combined rail. `movingIds` is the block being
 *  dragged (a page selection, or just `[INSERT_SLOT_ID]`). Returns the new page
 *  order and insert index, or null for a no-op (dropped on itself / its block). */
export function reorderRail(
  railIds: readonly string[],
  movingIds: readonly string[],
  activeId: string,
  overId: string,
): RailReorder | null {
  if (movingIds.includes(overId)) return null
  const activePos = railIds.indexOf(activeId)
  const overPos = railIds.indexOf(overId)
  if (activePos < 0 || overPos < 0) return null

  const remaining = railIds.filter((id) => !movingIds.includes(id))
  const overIdx = remaining.indexOf(overId)
  if (overIdx < 0) return null
  // Dropping below the grabbed item lands the block after the target, above lands
  // it before — the same rule whether pages or the slot is moving.
  const insertPos = activePos < overPos ? overIdx + 1 : overIdx
  const newRail = [...remaining.slice(0, insertPos), ...movingIds, ...remaining.slice(insertPos)]

  const slotPos = newRail.indexOf(INSERT_SLOT_ID)
  const order = newRail.filter((id) => id !== INSERT_SLOT_ID)
  const insertIndex =
    slotPos < 0
      ? order.length
      : newRail.slice(0, slotPos).filter((id) => id !== INSERT_SLOT_ID).length
  return { order, insertIndex }
}
