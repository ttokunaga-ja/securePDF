import ClearIcon from '@mui/icons-material/Clear'
import DeleteIcon from '@mui/icons-material/Delete'
import FlipIcon from '@mui/icons-material/Flip'
import RotateLeftIcon from '@mui/icons-material/RotateLeft'
import RotateRightIcon from '@mui/icons-material/RotateRight'
import SelectAllIcon from '@mui/icons-material/SelectAll'

import { t } from '../../app/i18n'
import { useDocActions, useDocState } from '../../features/document/DocumentContext'
import { ToolbarIconButton } from './ToolbarIconButton'

/** The five selection-scoped actions shown in the toolbar's left pane: delete,
 *  rotate left, flip, rotate right, and select-all / clear toggle. */
export function SelectionActions({ busy }: { busy: boolean }) {
  const { pages, selectedKeys } = useDocState()
  const { remove, rotate, flip, selectAll, clearSelection } = useDocActions()
  const selectedCount = selectedKeys.size
  const hasSelection = selectedCount > 0
  const selectionKeys = () => [...selectedKeys]

  return (
    <>
      <ToolbarIconButton
        title={t('toolbar.deleteSelected')}
        disabled={busy || selectedCount === 0}
        onClick={() => remove(selectionKeys())}
        fill
      >
        <DeleteIcon />
      </ToolbarIconButton>
      <ToolbarIconButton
        title={t('toolbar.rotateSelectedLeft')}
        disabled={busy || selectedCount === 0}
        onClick={() => rotate(selectionKeys(), -90)}
        fill
      >
        <RotateLeftIcon />
      </ToolbarIconButton>
      <ToolbarIconButton
        title={t('toolbar.flipSelected')}
        disabled={busy || selectedCount === 0}
        onClick={() => flip(selectionKeys())}
        fill
      >
        <FlipIcon />
      </ToolbarIconButton>
      <ToolbarIconButton
        title={t('toolbar.rotateSelectedRight')}
        disabled={busy || selectedCount === 0}
        onClick={() => rotate(selectionKeys(), 90)}
        fill
      >
        <RotateRightIcon />
      </ToolbarIconButton>
      <ToolbarIconButton
        title={hasSelection ? t('toolbar.clearSelection') : t('toolbar.selectAll')}
        disabled={busy || (!hasSelection && pages.length === 0)}
        onClick={hasSelection ? clearSelection : selectAll}
        fill
      >
        {hasSelection ? <ClearIcon /> : <SelectAllIcon />}
      </ToolbarIconButton>
    </>
  )
}
