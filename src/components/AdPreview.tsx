'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { drawAdPreview }   from '@/lib/homography'
import { ipfsImageUrl }    from '@/lib/ipfs'
import { Loader2, Download } from 'lucide-react'

interface AdPreviewProps {
  wallPhotoCid:     string
  artworkCid:       string
  wallCornersJson:  string   // JSON: [[x,y],[x,y],[x,y],[x,y]]
  onPreviewReady?:  (dataUrl: string) => void
}

/**
 * Renders a perspective-warped ad banner over the wall photo using Canvas.
 * The wall corners define the quad where the banner will be placed.
 */
export function AdPreview({
  wallPhotoCid,
  artworkCid,
  wallCornersJson,
  onPreviewReady,
}: AdPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status,  setStatus]  = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')

  const render = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    setStatus('loading')
    setMessage('Compositing preview...')

    try {
      const wallCorners: [number, number][] = JSON.parse(wallCornersJson)
      if (wallCorners.length !== 4) throw new Error('Need exactly 4 wall corners')

      const [wallImg, bannerImg] = await Promise.all([
        loadImage(ipfsImageUrl(wallPhotoCid)),
        loadImage(ipfsImageUrl(artworkCid)),
      ])

      // Size canvas to wall image aspect ratio
      const maxW = 800
      const scale = maxW / wallImg.naturalWidth
      canvas.width  = maxW
      canvas.height = wallImg.naturalHeight * scale

      const ctx = canvas.getContext('2d')!

      drawAdPreview(ctx, wallImg, bannerImg, wallCorners)

      setStatus('ready')
      setMessage('')

      if (onPreviewReady) {
        onPreviewReady(canvas.toDataURL('image/png'))
      }
    } catch (e) {
      setStatus('error')
      setMessage(e instanceof Error ? e.message : 'Preview generation failed')
    }
  }, [wallPhotoCid, artworkCid, wallCornersJson, onPreviewReady])

  useEffect(() => { render() }, [render])

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link    = document.createElement('a')
    link.download = 'wallad-preview.png'
    link.href     = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="space-y-3">
      {/* Canvas */}
      <div className="relative rounded-xl overflow-hidden bg-surface-raised border border-surface-border">
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-raised z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-brand" size={32} />
              <p className="text-sm text-slate-400">{message}</p>
            </div>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-raised z-10">
            <p className="text-sm text-red-400">{message}</p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ minHeight: 300 }}
        />
      </div>

      {/* Actions */}
      {status === 'ready' && (
        <div className="flex gap-3">
          <button onClick={handleDownload} className="btn-secondary text-sm py-2">
            <Download size={14} />
            Download Preview
          </button>
          <p className="text-xs text-slate-600 self-center">
            This is an approximate preview. Actual installation may vary.
          </p>
        </div>
      )}
    </div>
  )
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}
