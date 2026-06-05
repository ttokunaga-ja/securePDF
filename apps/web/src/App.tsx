import { run } from '@securepdf/core'
import DownloadIcon from '@mui/icons-material/Download'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import {
  Alert,
  AppBar,
  Box,
  Button,
  CircularProgress,
  Container,
  CssBaseline,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material'
import { useMemo, useRef, useState } from 'react'

import { PageCard } from './components/PageCard'
import { buildPlan } from './lib/buildPlan'
import { importFile, type LoadedFile } from './lib/importFile'

interface PageItem {
  key: string
  fileId: string
  pageIndex: number
  rotation: number
}

export default function App() {
  const [files, setFiles] = useState<LoadedFile[]>([])
  const [pages, setPages] = useState<PageItem[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const filesById = useMemo(() => new Map(files.map((file) => [file.id, file])), [files])

  async function onImport(list: FileList | null) {
    if (!list || list.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const imported: LoadedFile[] = []
      for (const file of Array.from(list)) imported.push(await importFile(file))
      setFiles((prev) => [...prev, ...imported])
      setPages((prev) => [
        ...prev,
        ...imported.flatMap((file) =>
          Array.from({ length: file.pageCount }, (_, i) => ({
            key: `${file.id}:${i}`,
            fileId: file.id,
            pageIndex: i,
            rotation: 0,
          })),
        ),
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const rotate = (key: string, delta: number) =>
    setPages((prev) =>
      prev.map((p) =>
        p.key === key ? { ...p, rotation: (((p.rotation + delta) % 360) + 360) % 360 } : p,
      ),
    )

  const remove = (key: string) => setPages((prev) => prev.filter((p) => p.key !== key))

  const move = (key: string, direction: -1 | 1) =>
    setPages((prev) => {
      const i = prev.findIndex((p) => p.key === key)
      const j = i + direction
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  async function onExport() {
    if (pages.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const plan = buildPlan(
        pages.map((p) => ({ fileId: p.fileId, pageIndex: p.pageIndex, rotation: p.rotation })),
        files.map((file) => ({ id: file.id, filename: file.filename, pageCount: file.pageCount })),
      )
      const result = await run(
        plan,
        files.map((file) => ({
          id: file.id,
          bytes: file.bytes,
          filename: file.filename,
          type: 'application/pdf',
        })),
      )
      if (!result.ok) {
        setError(result.errors?.[0]?.message ?? 'エクスポートに失敗しました')
        return
      }
      downloadFile(result.outputs[0].filename, result.outputs[0].bytes)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <CssBaseline />
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
            securePDF
          </Typography>
          <Button
            startIcon={<UploadFileIcon />}
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            読み込み
          </Button>
          <Button
            startIcon={<DownloadIcon />}
            variant="contained"
            sx={{ ml: 1 }}
            onClick={() => void onExport()}
            disabled={busy || pages.length === 0}
          >
            書き出し
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            multiple
            hidden
            onChange={(e) => void onImport(e.target.files)}
          />
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <Box
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            void onImport(e.dataTransfer.files)
          }}
          sx={{
            minHeight: 320,
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            p: 2,
          }}
        >
          {pages.length === 0 ? (
            <Stack
              alignItems="center"
              justifyContent="center"
              spacing={1}
              sx={{ height: 300, color: 'text.secondary', textAlign: 'center' }}
            >
              {busy ? (
                <CircularProgress />
              ) : (
                <>
                  <UploadFileIcon sx={{ fontSize: 48 }} />
                  <Typography>PDF・JPEG・PNG をドラッグ＆ドロップ、または「読み込み」</Typography>
                  <Typography variant="caption">
                    ファイルはブラウザ内だけで処理され、サーバーへは送信されません
                  </Typography>
                </>
              )}
            </Stack>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
              {pages.map((page, index) => {
                const file = filesById.get(page.fileId)
                if (!file) return null
                return (
                  <PageCard
                    key={page.key}
                    pdf={file.pdf}
                    pageIndex={page.pageIndex}
                    rotation={page.rotation}
                    position={index + 1}
                    total={pages.length}
                    onRotate={(delta) => rotate(page.key, delta)}
                    onDelete={() => remove(page.key)}
                    onMove={(direction) => move(page.key, direction)}
                  />
                )
              })}
            </Box>
          )}
        </Box>
        {busy && pages.length > 0 && (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              処理中…
            </Typography>
          </Stack>
        )}
      </Container>
    </>
  )
}

function downloadFile(name: string, bytes: Uint8Array) {
  // Copy into a plain ArrayBuffer so the Blob part type is unambiguous.
  const part = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  const blob = new Blob([part], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}
