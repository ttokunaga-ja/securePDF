import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CodeRoundedIcon from '@mui/icons-material/CodeRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded'
import { Box, Button, Container, IconButton, Paper, Stack, Tooltip } from '@mui/material'
import { marked } from 'marked'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import apiMarkdown from '../../content/ja/api.md?raw'
import overviewMarkdown from '../../content/ja/overview.md?raw'
import securityMarkdown from '../../content/ja/security.md?raw'
import { chrome } from '../app/theme'
import { type InfoPageKind, infoPathForPage } from '../lib/infoRoutes'

type CodeBlockTarget = {
  id: string
  element: HTMLPreElement
}

const INFO_PAGES: Record<InfoPageKind, { title: string; markdown: string }> = {
  overview: { title: 'サービス概要', markdown: overviewMarkdown },
  security: { title: 'セキュリティポリシー', markdown: securityMarkdown },
  api: { title: 'APIドキュメント', markdown: apiMarkdown },
}

const DOC_NAV: Array<{ page: InfoPageKind; label: string; icon: ReactElement }> = [
  { page: 'overview', label: 'サービス概要', icon: <InfoOutlinedIcon fontSize="small" /> },
  {
    page: 'security',
    label: 'セキュリティポリシー',
    icon: <SecurityRoundedIcon fontSize="small" />,
  },
  { page: 'api', label: 'APIドキュメント', icon: <CodeRoundedIcon fontSize="small" /> },
]

export function InfoPage({ page }: { page: InfoPageKind }) {
  const doc = INFO_PAGES[page]
  const html = useMemo(
    () => marked.parse(doc.markdown, { async: false, gfm: true }) as string,
    [doc.markdown],
  )
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [codeBlocks, setCodeBlocks] = useState<CodeBlockTarget[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    document.title = `${doc.title} | securePDF`
  }, [doc.title])

  useEffect(() => {
    const container = contentRef.current
    if (!container) {
      setCodeBlocks([])
      return
    }
    setCodeBlocks(
      Array.from(container.querySelectorAll<HTMLPreElement>('pre')).map((element, index) => ({
        id: `${page}-${index}`,
        element,
      })),
    )
    setCopiedId(null)
  }, [html, page])

  const handleCopyCodeBlock = useCallback(async (block: CodeBlockTarget) => {
    const text = block.element.querySelector('code')?.textContent ?? ''
    if (!text) return
    const copied = await copyTextToClipboard(text)
    if (!copied) return
    setCopiedId(block.id)
    window.setTimeout(() => {
      setCopiedId((current) => (current === block.id ? null : current))
    }, 1400)
  }, [])

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7f8', color: '#202124' }}>
      <Box
        component="header"
        sx={{
          bgcolor: chrome.toolbarBg,
          color: chrome.toolbarText,
          borderBottom: `1px solid ${chrome.dividerOnDark}`,
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            minHeight: 64,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            py: 1,
          }}
        >
          <Button
            href="/"
            startIcon={<ArrowBackRoundedIcon />}
            sx={{
              color: chrome.toolbarText,
              borderColor: chrome.dividerOnDark,
              flex: '0 0 auto',
              '&:hover': { borderColor: chrome.fieldBorderHover, bgcolor: chrome.toolbarHover },
            }}
            variant="outlined"
          >
            securePDF
          </Button>
          <Stack
            component="nav"
            direction="row"
            spacing={0.75}
            useFlexGap
            flexWrap="wrap"
            sx={{ minWidth: 0 }}
          >
            {DOC_NAV.map((item) => (
              <Button
                key={item.page}
                href={infoPathForPage(item.page)}
                aria-current={item.page === page ? 'page' : undefined}
                startIcon={item.icon}
                size="small"
                sx={{
                  color: chrome.toolbarText,
                  bgcolor: item.page === page ? chrome.toolbarHover : 'transparent',
                  '&:hover': { bgcolor: chrome.toolbarHover },
                }}
              >
                {item.label}
              </Button>
            ))}
          </Stack>
        </Container>
      </Box>

      <Box component="main">
        <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
          <Paper
            variant="outlined"
            sx={{
              p: { xs: 2, sm: 3, md: 4 },
              fontSize: '1.04rem',
              lineHeight: 1.78,
              color: '#202124',
              borderColor: '#dadce0',
              '& > *:first-of-type': { mt: 0 },
              '& h1': {
                mt: 0,
                mb: 2,
                fontSize: { xs: 34, md: 44 },
                lineHeight: 1.12,
                letterSpacing: 0,
              },
              '& h2': { mt: 5, mb: 1.5, fontSize: '1.65rem', lineHeight: 1.25 },
              '& h3': { mt: 3.5, mb: 1, fontSize: '1.18rem' },
              '& p': { color: '#3c4043' },
              '& p, & ul, & ol, & blockquote, & pre, & table': { mb: 2 },
              '& ul, & ol': { pl: 3 },
              '& li': { mb: 0.7, color: '#3c4043' },
              '& a': { color: '#174ea6', fontWeight: 700, overflowWrap: 'anywhere' },
              '& code': {
                px: 0.6,
                py: 0.15,
                borderRadius: 1,
                border: '1px solid #dadce0',
                bgcolor: '#f1f3f4',
                overflowWrap: 'anywhere',
              },
              '& pre': {
                position: 'relative',
                overflowX: 'auto',
                p: 1.5,
                pr: 6,
                borderRadius: 1,
                bgcolor: '#202124',
                color: '#f1f3f4',
                whiteSpace: 'pre-wrap',
              },
              '& pre code': {
                display: 'block',
                p: 0,
                border: 0,
                bgcolor: 'transparent',
                color: 'inherit',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              },
              '& blockquote': {
                m: 0,
                p: 1.5,
                borderLeft: 4,
                borderColor: chrome.focusRing,
                bgcolor: '#f1f3f4',
              },
              '& blockquote p': { m: 0 },
              '& table': {
                display: 'block',
                width: '100%',
                overflowX: 'auto',
                borderCollapse: 'collapse',
              },
              '& th, & td': {
                border: '1px solid #dadce0',
                px: 1.25,
                py: 0.9,
                textAlign: 'left',
                verticalAlign: 'top',
              },
              '& th': { bgcolor: '#f1f3f4' },
            }}
          >
            <Box
              ref={contentRef}
              component="article"
              aria-label={doc.title}
              dangerouslySetInnerHTML={{ __html: html }}
            />
            {codeBlocks.map((block) => (
              <CodeCopyButton
                key={block.id}
                block={block}
                copied={copiedId === block.id}
                onCopy={handleCopyCodeBlock}
              />
            ))}
          </Paper>
        </Container>
      </Box>
    </Box>
  )
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to the textarea fallback for browsers that block clipboard.
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.inset = '0 auto auto 0'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)
  return copied
}

function CodeCopyButton({
  block,
  copied,
  onCopy,
}: {
  block: CodeBlockTarget
  copied: boolean
  onCopy: (block: CodeBlockTarget) => void
}) {
  const label = copied ? 'コピーしました' : 'コードをコピー'

  return createPortal(
    <Tooltip title={label}>
      <IconButton
        size="small"
        aria-label={label}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onCopy(block)
        }}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          color: '#ffffff',
          border: '1px solid rgba(255, 255, 255, 0.24)',
          bgcolor: copied ? 'rgba(52, 168, 83, 0.28)' : 'rgba(255, 255, 255, 0.12)',
          '&:hover': {
            bgcolor: copied ? 'rgba(52, 168, 83, 0.38)' : 'rgba(255, 255, 255, 0.22)',
          },
        }}
      >
        {copied ? (
          <CheckRoundedIcon fontSize="small" />
        ) : (
          <ContentCopyRoundedIcon fontSize="small" />
        )}
      </IconButton>
    </Tooltip>,
    block.element,
  )
}
