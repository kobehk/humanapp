'use client'

import { useEffect, useRef, useState } from 'react'

// TODO: 申请到广告位 ID 后填入，留空则不加载对应平台
const CSJ_SLOT_ID = ''
const GDT_SLOT_ID = ''

type Provider = 'csj' | 'gdt' | null

function pickProvider(): Provider {
  const hasCsj = !!CSJ_SLOT_ID
  const hasGdt = !!GDT_SLOT_ID
  if (hasCsj && hasGdt) return Math.random() < 0.5 ? 'csj' : 'gdt'
  if (hasCsj) return 'csj'
  if (hasGdt) return 'gdt'
  return null
}

export function AdSlot({ className }: { className?: string }) {
  const [provider, setProvider] = useState<Provider>(null)
  const ref = useRef<HTMLDivElement>(null)
  const loaded = useRef(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setProvider(pickProvider()), 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!provider || loaded.current || !ref.current) return
    loaded.current = true
    try {
      const w = window as Window & {
        csj?: { push: (options: { slotId: string; container: HTMLDivElement }) => void }
        TencentGDT?: {
          NATIVE: { loadAd: (options: { placementId: string; container: HTMLDivElement }) => void }
        }
      }
      if (provider === 'csj' && w.csj) {
        w.csj.push({ slotId: CSJ_SLOT_ID, container: ref.current })
      } else if (provider === 'gdt' && w.TencentGDT) {
        w.TencentGDT.NATIVE.loadAd({ placementId: GDT_SLOT_ID, container: ref.current })
      }
    } catch {}
  }, [provider])

  if (!provider) return null

  return (
    <div ref={ref} className={`w-full flex items-center justify-center ${className ?? ''}`} />
  )
}
