/**
 * Homography and perspective warp utilities.
 * Used for:
 *   1. Wall area estimation from reference object (A4 sheet)
 *   2. Ad banner preview generation via canvas perspective warp
 *
 * Reference: "Multiple View Geometry in Computer Vision", Hartley & Zisserman
 */

export type Point2D = { x: number; y: number }
export type Matrix3x3 = number[][]  // row-major 3×3

// ─── Homography Computation ────────────────────────────────────────────────

/**
 * Compute 3×3 homography matrix H such that dst[i] ≈ H × src[i].
 * Requires exactly 4 point correspondences.
 *
 * Uses Direct Linear Transform (DLT) algorithm.
 */
export function computeHomography(
  src: Point2D[],
  dst: Point2D[]
): Matrix3x3 {
  if (src.length !== 4 || dst.length !== 4) {
    throw new Error('computeHomography requires exactly 4 point pairs')
  }

  // Build the 8×9 matrix A for the DLT system Ah = 0
  const A: number[][] = []

  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = src[i]
    const { x: dx, y: dy } = dst[i]

    A.push([-sx, -sy, -1, 0, 0, 0, dx * sx, dx * sy, dx])
    A.push([0, 0, 0, -sx, -sy, -1, dy * sx, dy * sy, dy])
  }

  // SVD of A → h = last row of V^T (9-vector)
  const h = svdSmallestSingularVector(A)

  return [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], h[8]],
  ]
}

/**
 * Apply homography H to a point.
 */
export function applyHomography(H: Matrix3x3, p: Point2D): Point2D {
  const w = H[2][0] * p.x + H[2][1] * p.y + H[2][2]
  return {
    x: (H[0][0] * p.x + H[0][1] * p.y + H[0][2]) / w,
    y: (H[1][0] * p.x + H[1][1] * p.y + H[1][2]) / w,
  }
}

// ─── Wall Area Estimation ──────────────────────────────────────────────────

const A4_W_MM = 210.0
const A4_H_MM = 297.0
const MM_TO_FT = 0.00328084

/**
 * Estimate wall dimensions from user-tapped corners.
 *
 * @param a4Corners  4 image-space [x,y] corners of the A4 sheet (TL→TR→BR→BL)
 * @param wallCorners  4 image-space [x,y] corners of the visible wall area
 * @param imageW  Image width in pixels
 * @param imageH  Image height in pixels
 * @param a4IsPortrait  Whether A4 was placed portrait (true) or landscape (false)
 */
export function estimateWallArea(
  a4Corners:   Point2D[],
  wallCorners: Point2D[],
  imageW:      number,
  imageH:      number,
  a4IsPortrait = true
): {
  widthFt:   number
  heightFt:  number
  areaSqft:  number
  wallCornersNorm: [number, number][]
} {
  const a4W = a4IsPortrait ? A4_W_MM : A4_H_MM
  const a4H = a4IsPortrait ? A4_H_MM : A4_W_MM

  // Destination: A4 in metric coords (mm)
  const a4Dst: Point2D[] = [
    { x: 0,    y: 0    },
    { x: a4W,  y: 0    },
    { x: a4W,  y: a4H  },
    { x: 0,    y: a4H  },
  ]

  // Homography: image → metric
  const H = computeHomography(a4Corners, a4Dst)

  // Map wall corners to metric space
  const wallMetric = wallCorners.map(p => applyHomography(H, p))

  // Compute wall dimensions
  const widthMM  = dist(wallMetric[0], wallMetric[1])
  const heightMM = dist(wallMetric[0], wallMetric[3])

  const widthFt  = widthMM  * MM_TO_FT
  const heightFt = heightMM * MM_TO_FT
  const areaSqft = widthFt  * heightFt

  // Normalize wall corners to [0,1] for storage
  const wallCornersNorm = wallCorners.map(
    p => [p.x / imageW, p.y / imageH] as [number, number]
  )

  return {
    widthFt:   round2(widthFt),
    heightFt:  round2(heightFt),
    areaSqft:  round3(areaSqft),
    wallCornersNorm,
  }
}

// ─── Canvas-based Ad Preview ───────────────────────────────────────────────

/**
 * Draw a perspective-warped banner onto a canvas over a wall image.
 *
 * @param ctx           Canvas 2D context (sized to wall image)
 * @param wallImg       HTMLImageElement of wall reference photo
 * @param bannerImg     HTMLImageElement of ad banner
 * @param wallCornersNorm  Normalized [0,1] wall corners [TL,TR,BR,BL]
 */
export function drawAdPreview(
  ctx:             CanvasRenderingContext2D,
  wallImg:         HTMLImageElement,
  bannerImg:       HTMLImageElement,
  wallCornersNorm: [number, number][]
): void {
  const W = ctx.canvas.width
  const H = ctx.canvas.height

  // Draw wall photo
  ctx.drawImage(wallImg, 0, 0, W, H)

  // Denormalize corners
  const dst = wallCornersNorm.map(([x, y]) => ({ x: x * W, y: y * H }))

  // Source: banner corners
  const src: Point2D[] = [
    { x: 0,               y: 0                },
    { x: bannerImg.width, y: 0                },
    { x: bannerImg.width, y: bannerImg.height },
    { x: 0,               y: bannerImg.height },
  ]

  // Compute homography: banner → wall quad
  const H_mat = computeHomography(src, dst)

  // Warp banner to wall quad using scanline rasterization
  warpImage(ctx, bannerImg, H_mat, dst)
}

/**
 * Rasterize a warped image onto canvas using inverse mapping (per-scanline).
 * This is a simplified approximation — good enough for preview purposes.
 */
function warpImage(
  ctx:      CanvasRenderingContext2D,
  img:      HTMLImageElement,
  H:        Matrix3x3,
  dstQuad:  Point2D[]
): void {
  // Create off-screen canvas for source image
  const srcCanvas  = document.createElement('canvas')
  srcCanvas.width  = img.width
  srcCanvas.height = img.height
  const srcCtx     = srcCanvas.getContext('2d')!
  srcCtx.drawImage(img, 0, 0)
  const srcData    = srcCtx.getImageData(0, 0, img.width, img.height)

  const dstData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)

  // Compute inverse homography for per-pixel mapping
  const Hinv = invertMatrix3x3(H)

  // Compute bounding box of destination quad
  const xs = dstQuad.map(p => p.x)
  const ys = dstQuad.map(p => p.y)
  const x0 = Math.max(0, Math.floor(Math.min(...xs)))
  const x1 = Math.min(ctx.canvas.width  - 1, Math.ceil(Math.max(...xs)))
  const y0 = Math.max(0, Math.floor(Math.min(...ys)))
  const y1 = Math.min(ctx.canvas.height - 1, Math.ceil(Math.max(...ys)))

  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      // Check if pixel is inside the destination quad
      if (!isInsideQuad({ x: px, y: py }, dstQuad)) continue

      // Map destination pixel back to source using inverse homography
      const sp = applyHomography(Hinv, { x: px, y: py })
      const sx = Math.round(sp.x)
      const sy = Math.round(sp.y)

      if (sx < 0 || sx >= img.width || sy < 0 || sy >= img.height) continue

      const srcIdx = (sy * img.width + sx) * 4
      const dstIdx = (py * ctx.canvas.width + px) * 4

      // Alpha blend: use source alpha if banner has transparency
      const srcAlpha = srcData.data[srcIdx + 3] / 255
      dstData.data[dstIdx]     = srcData.data[srcIdx]     * srcAlpha + dstData.data[dstIdx]     * (1 - srcAlpha)
      dstData.data[dstIdx + 1] = srcData.data[srcIdx + 1] * srcAlpha + dstData.data[dstIdx + 1] * (1 - srcAlpha)
      dstData.data[dstIdx + 2] = srcData.data[srcIdx + 2] * srcAlpha + dstData.data[dstIdx + 2] * (1 - srcAlpha)
      dstData.data[dstIdx + 3] = 255
    }
  }

  ctx.putImageData(dstData, 0, 0)
}

// ─── Linear Algebra Helpers ───────────────────────────────────────────────

/**
 * Compute the smallest singular vector of an m×9 matrix using power iteration.
 * For the DLT algorithm this gives us the homography coefficients.
 *
 * This is a simplified Jacobi SVD approach sufficient for 8×9 matrices.
 */
function svdSmallestSingularVector(A: number[][]): number[] {
  const m = A.length
  const n = A[0].length

  // Compute AtA (9×9)
  const AtA: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0
      for (let k = 0; k < m; k++) sum += A[k][i] * A[k][j]
      AtA[i][j] = sum
    }
  }

  // Power iteration to find smallest eigenvector
  // Initialize with random vector
  let v: number[] = Array.from({ length: n }, (_, i) => i === n - 1 ? 1 : 0.1)

  // Deflate: subtract contribution of largest eigenvalue iteratively
  // For our purposes, 100 iterations on AtA gives sufficient accuracy
  for (let iter = 0; iter < 200; iter++) {
    // Multiply AtA by v
    const Av: number[] = new Array(n).fill(0)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) Av[i] += AtA[i][j] * v[j]
    }

    // Normalize
    const norm = Math.sqrt(Av.reduce((s, x) => s + x * x, 0))
    v = Av.map(x => x / norm)
  }

  // v is the largest eigenvector of AtA (= largest singular vector of A)
  // We want the smallest: use inverse iteration with a small shift
  const shift = 0
  const AtA_shifted = AtA.map((row, i) =>
    row.map((val, j) => val - shift * (i === j ? 1 : 0))
  )

  // Solve (AtA - shift*I) * x = v via Gaussian elimination
  let x = solveLinearSystem(AtA_shifted, v)
  const norm = Math.sqrt(x.reduce((s, xi) => s + xi * xi, 0))
  x = x.map(xi => xi / norm)

  return x
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length
  const M = A.map((row, i) => [...row, b[i]])

  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col
    let maxVal = Math.abs(M[col][col])
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col])
        maxRow = row
      }
    }
    ;[M[col], M[maxRow]] = [M[maxRow], M[col]]

    if (Math.abs(M[col][col]) < 1e-12) continue

    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = M[row][col] / M[col][col]
      for (let k = col; k <= n; k++) M[row][k] -= factor * M[col][k]
    }
  }

  return M.map((row, i) => row[n] / (row[i] || 1e-12))
}

function invertMatrix3x3(M: Matrix3x3): Matrix3x3 {
  const [[a,b,c],[d,e,f],[g,h,k]] = M
  const det = a*(e*k-f*h) - b*(d*k-f*g) + c*(d*h-e*g)
  if (Math.abs(det) < 1e-12) return M  // degenerate fallback

  const inv = 1 / det
  return [
    [ (e*k-f*h)*inv, (c*h-b*k)*inv, (b*f-c*e)*inv ],
    [ (f*g-d*k)*inv, (a*k-c*g)*inv, (c*d-a*f)*inv ],
    [ (d*h-e*g)*inv, (b*g-a*h)*inv, (a*e-b*d)*inv ],
  ]
}

function isInsideQuad(p: Point2D, quad: Point2D[]): boolean {
  // Cross product test for convex quad (assumes TL→TR→BR→BL order)
  for (let i = 0; i < 4; i++) {
    const a = quad[i]
    const b = quad[(i + 1) % 4]
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
    if (cross < 0) return false
  }
  return true
}

function dist(a: Point2D, b: Point2D): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)
}

function round2(n: number): number { return Math.round(n * 100) / 100 }
function round3(n: number): number { return Math.round(n * 1000) / 1000 }
