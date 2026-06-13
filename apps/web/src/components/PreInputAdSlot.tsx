import { Box, Typography } from '@mui/material'
import { useEffect, useRef } from 'react'

import { t } from '../app/i18n'

type PreInputAdPlacement = 'top' | 'bottom'

interface PreInputAdSlotProps {
  placement: PreInputAdPlacement
}

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

const ADSENSE_SCRIPT_ID = 'securepdf-adsense-script'

const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT?.trim()
const ADSENSE_SLOTS: Record<PreInputAdPlacement, string | undefined> = {
  top: import.meta.env.VITE_ADSENSE_EMPTY_TOP_SLOT?.trim(),
  bottom: import.meta.env.VITE_ADSENSE_EMPTY_BOTTOM_SLOT?.trim(),
}
const SHOW_PLACEHOLDER =
  import.meta.env.VITE_ADSENSE_PLACEHOLDER === 'true' ||
  (import.meta.env.DEV && import.meta.env.MODE !== 'test')

function ensureAdSenseScript(client: string) {
  if (typeof document === 'undefined') return
  if (document.getElementById(ADSENSE_SCRIPT_ID)) return
  if (
    document.querySelector(
      `script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}"]`,
    )
  ) {
    return
  }

  const script = document.createElement('script')
  script.id = ADSENSE_SCRIPT_ID
  script.async = true
  script.crossOrigin = 'anonymous'
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
    client,
  )}`
  document.head.appendChild(script)
}

/** AdSense slot shown only before a file is opened. The slot is deliberately
 *  separated from the file-open CTA to reduce accidental-click risk. */
export function PreInputAdSlot({ placement }: PreInputAdSlotProps) {
  const slot = ADSENSE_SLOTS[placement]
  const configured = Boolean(ADSENSE_CLIENT && slot)
  const pushedRef = useRef(false)

  useEffect(() => {
    if (!configured || !ADSENSE_CLIENT || pushedRef.current) return
    ensureAdSenseScript(ADSENSE_CLIENT)
    window.adsbygoogle = window.adsbygoogle ?? []
    window.adsbygoogle.push({})
    pushedRef.current = true
  }, [configured])

  if (!configured && !SHOW_PLACEHOLDER) return null

  const minHeight = placement === 'top' ? { xs: 96, md: 110 } : { xs: 120, md: 250 }
  const width = placement === 'top' ? { xs: '100%', md: 728 } : { xs: '100%', md: 760 }

  return (
    <Box
      component="aside"
      aria-label={t('ad.regionLabel')}
      data-pre-input-ad={placement}
      sx={{
        width: '100%',
        maxWidth: width,
        minHeight,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'center',
        gap: 0.75,
        mx: 'auto',
        opacity: configured ? 1 : 0.82,
      }}
    >
      <Typography
        component="p"
        sx={{
          m: 0,
          color: 'rgba(255,255,255,0.74)',
          fontSize: 12,
          lineHeight: 1.4,
          textAlign: 'center',
        }}
      >
        {t('ad.label')}
      </Typography>

      {configured && ADSENSE_CLIENT && slot ? (
        <Box
          component="ins"
          className="adsbygoogle"
          sx={{
            display: 'block',
            minHeight,
            width: '100%',
            borderRadius: 1,
            overflow: 'hidden',
          }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : (
        <Box
          aria-hidden="true"
          sx={{
            minHeight,
            width: '100%',
            border: '1px dashed rgba(255,255,255,0.42)',
            borderRadius: 1,
            bgcolor: 'rgba(255,255,255,0.10)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.68)',
            fontSize: 13,
          }}
        >
          {t('ad.placeholder')}
        </Box>
      )}
    </Box>
  )
}
