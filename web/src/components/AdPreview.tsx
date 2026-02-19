'use client'

import { useState, useEffect } from 'react'
import { ipfsImageUrl } from '@/lib/ipfs'
import { Loader2, Sparkles, AlertCircle, Download } from 'lucide-react'

interface AdPreviewProps {
  wallPhotoCid: string
  artworkCid: string
  wallCornersJson: string
  onPreviewReady?: (dataUrl: string) => void
}

export function AdPreview({
  wallPhotoCid,
  artworkCid,
  wallCornersJson,
  onPreviewReady,
}: AdPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle')

  const generateAIPreview = async () => {
    setStatus('generating')
    try {
      const res = await fetch('/api/preview/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallPhotoCid, artworkCid, wallCornersJson })
      })

      const data = await res.json()
      if (data.previewUrl) {
        setPreviewUrl(data.previewUrl)
        setStatus('ready')
        if (onPreviewReady) onPreviewReady(data.previewUrl)
      } else {
        throw new Error(data.error)
      }
    } catch (e) {
      setStatus('error')
    }
  }

  // Generate automatically when the component mounts if we have the data
  useEffect(() => {
    if (wallPhotoCid && artworkCid && wallCornersJson) {
      generateAIPreview()
    }
  }, [wallPhotoCid, artworkCid, wallCornersJson])

  return (
    <div className="space-y-4">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-surface-raised border border-surface-border group">
        
        {/* Loading State */}
        {status === 'generating' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="relative">
              <Loader2 className="animate-spin text-brand" size={40} />
              <Sparkles className="absolute -top-2 -right-2 text-yellow-400 animate-pulse" size={20} />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-200">Nano Banana AI is compositing...</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Realistic Lighting & Perspective</p>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-red-500/10 backdrop-blur-md">
            <AlertCircle className="text-red-400 mb-2" size={32} />
            <p className="text-sm text-red-400 font-medium">AI Generation Failed</p>
            <button 
              onClick={generateAIPreview}
              className="mt-3 text-xs bg-red-400/20 text-red-400 px-3 py-1 rounded-full border border-red-400/30 hover:bg-red-400/30"
            >
              Retry Generation
            </button>
          </div>
        )}

        {/* Result Image */}
        {previewUrl ? (
          <img 
            src={previewUrl} 
            className="w-full h-full object-cover animate-fade-in" 
            alt="AI Preview" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
             <img src={ipfsImageUrl(wallPhotoCid)} className="opacity-20 grayscale" />
          </div>
        )}
      </div>

      {status === 'ready' && (
        <div className="flex items-center justify-between p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500/20 p-1 rounded">
              <Sparkles size={14} className="text-emerald-400" />
            </div>
            <span className="text-xs text-slate-300 font-medium">AI-Enhanced Preview Ready</span>
          </div>
          <a 
            href={previewUrl!} 
            download="ai-preview.png"
            className="text-[10px] text-emerald-400 font-bold hover:underline flex items-center gap-1"
          >
            <Download size={12} /> DOWNLOAD HD
          </a>
        </div>
      )}
    </div>
  )
}