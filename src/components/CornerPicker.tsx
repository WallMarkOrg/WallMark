'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Point2D }    from '@/lib/homography'
import { cn }         from '@/lib/utils'

interface CornerPickerProps {
  imageUrl:     string
  mode:         'a4' | 'wall'        // which quad is being picked
  corners:      Point2D[]            // current 4 corners (may be empty initially)
  onCornersSet: (corners: Point2D[]) => void
  className?:   string
}

const CORNER_LABELS = ['TL', 'TR', 'BR', 'BL']
const CORNER_COLORS = ['#F5A623', '#3B82F6', '#10B981', '#8B5CF6']

/**
 * Interactive canvas component for picking 4 corners of a quad.
 * Used for both A4 sheet corner selection and wall boundary selection.
 */
export function CornerPicker({
  imageUrl,
  mode,
  corners,
  onCornersSet,
  className,
}: CornerPickerProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const imageRef     = useRef<HTMLImageElement | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [dragging, setDragging] = useState<number | null>(null)

  const localCorners = useRef<Point2D[]>(corners)

  // Load image and draw initial state
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imageUrl
    img.onload = () => {
      imageRef.current = img
      setLoaded(true)
      renderCanvas(localCorners.current)
    }
  }, [imageUrl])

  useEffect(() => {
    localCorners.current = corners
    if (loaded) renderCanvas(corners)
  }, [corners, loaded])

  const renderCanvas = useCallback((pts: Point2D[]) => {
    const canvas = canvasRef.current
    const img    = imageRef.current
    if (!canvas || !img) return

    const W = canvas.width
    const H = canvas.height
    const ctx = canvas.getContext('2d')!

    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(img, 0, 0, W, H)

    if (pts.length < 2) return

    // Draw quad outline
    ctx.beginPath()
    ctx.moveTo(pts[0].x * W, pts[0].y * H)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * W, pts[i].y * H)
    if (pts.length === 4) ctx.closePath()
    ctx.strokeStyle = 'rgba(245,166,35,0.8)'
    ctx.lineWidth   = 2
    ctx.setLineDash([4, 4])
    ctx.stroke()
    ctx.setLineDash([])

    // Draw corner dots
    pts.forEach((p, i) => {
      const px = p.x * W
      const py = p.y * H

      ctx.beginPath()
      ctx.arc(px, py, 10, 0, Math.PI * 2)
      ctx.fillStyle   = CORNER_COLORS[i] + '33'
      ctx.fill()
      ctx.strokeStyle = CORNER_COLORS[i]
      ctx.lineWidth   = 2
      ctx.stroke()

      // Label
      ctx.fillStyle  = '#fff'
      ctx.font       = 'bold 11px Inter, sans-serif'
      ctx.textAlign  = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(CORNER_LABELS[i], px, py)
    })
  }, [])

  const getCanvasCoords = (e: React.MouseEvent): Point2D => {
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top)  / rect.height,
    }
  }

  const findNearestCorner = (p: Point2D, thresh = 0.04): number => {
    const corners = localCorners.current
    for (let i = 0; i < corners.length; i++) {
      const dx = corners[i].x - p.x
      const dy = corners[i].y - p.y
      if (Math.sqrt(dx * dx + dy * dy) < thresh) return i
    }
    return -1
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const p    = getCanvasCoords(e)
    const near = findNearestCorner(p)
    if (near !== -1) {
      setDragging(near)
      return
    }
    // Add new corner (up to 4)
    if (localCorners.current.length < 4) {
      const next = [...localCorners.current, p]
      localCorners.current = next
      onCornersSet(next)
      renderCanvas(next)
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging === null) return
    const p    = getCanvasCoords(e)
    const next = [...localCorners.current]
    next[dragging] = p
    localCorners.current = next
    onCornersSet(next)
    renderCanvas(next)
  }

  const handleMouseUp = () => setDragging(null)

  const reset = () => {
    localCorners.current = []
    onCornersSet([])
    renderCanvas([])
  }

  const instruction =
    corners.length < 4
      ? `Click to place corner ${corners.length + 1} of 4 (${CORNER_LABELS[corners.length]})`
      : 'Drag corners to adjust — all 4 set ✓'

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          <span className="text-brand font-medium">
            {mode === 'a4' ? 'A4 Sheet' : 'Wall Boundary'}
          </span>
          {' — '}{instruction}
        </p>
        {corners.length > 0 && (
          <button onClick={reset} className="text-xs text-red-400 hover:text-red-300">
            Reset
          </button>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className={cn(
          'w-full rounded-lg border cursor-crosshair',
          loaded ? 'border-surface-border' : 'border-transparent bg-surface-raised'
        )}
        style={{ aspectRatio: '4/3' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {/* Corner legend */}
      <div className="flex gap-4">
        {CORNER_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: CORNER_COLORS[i] }}
            />
            {label}
            {corners[i] && (
              <span className="text-slate-600">
                ({(corners[i].x * 100).toFixed(0)}%, {(corners[i].y * 100).toFixed(0)}%)
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
