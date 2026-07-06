'use client'

import type { GalleryItem } from './types'

const GALLERY_KEY = 'jiaban_gallery'
const GALLERY_MAX = 10
// Thumbnail width for storage — keeps each item ~15-30KB instead of full resolution
const THUMB_WIDTH = 240
// Reserve at least this many bytes in localStorage before writing
const MIN_FREE_BYTES = 100 * 1024 // 100 KB

function estimateFreeBytes(): number {
  // Binary-search how many 1KB chunks fit before QuotaExceededError
  const chunk = 'x'.repeat(1024)
  const key = '__jiaban_probe__'
  let lo = 0
  let hi = 5 * 1024 // probe up to 5 MB worth of chunks
  try {
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      try {
        localStorage.setItem(key, chunk.repeat(mid))
        lo = mid
      } catch {
        hi = mid - 1
      }
    }
  } finally {
    localStorage.removeItem(key)
  }
  return lo * 1024
}

function resizeDataUrl(dataUrl: string, maxWidth: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.75))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export function loadGallery(): GalleryItem[] {
  try {
    const raw = localStorage.getItem(GALLERY_KEY)
    return raw ? (JSON.parse(raw) as GalleryItem[]) : []
  } catch {
    return []
  }
}

export async function addGalleryItem(item: Omit<GalleryItem, 'dataUrl'> & { dataUrl: string }) {
  const thumb = await resizeDataUrl(item.dataUrl, THUMB_WIDTH)
  const entry: GalleryItem = { ...item, dataUrl: thumb }
  try {
    if (estimateFreeBytes() < MIN_FREE_BYTES) return  // not enough space, skip silently
    const all = loadGallery()
    all.unshift(entry)
    localStorage.setItem(GALLERY_KEY, JSON.stringify(all.slice(0, GALLERY_MAX)))
  } catch {
    // write failed anyway — ignore
  }
}
