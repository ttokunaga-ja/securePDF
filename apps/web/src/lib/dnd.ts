// Native HTML5 drag contract. Page and insert-slot reordering is handled by
// dnd-kit (pointer based); the only native drag left is OS file import, used by
// InitialDropZone (empty workspace) and InsertSlot (a specific position).

/** True when the drag carries OS files (an import). */
export function hasFileTransfer(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes('Files')
}
