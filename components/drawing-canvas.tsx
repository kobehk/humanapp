'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

type Tool = 'pencil' | 'eraser' | 'pen' | 'fill' | 'hand' | 'lasso' | 'pressure'

const PRESET_COLORS = ['#1a1a1a', '#f9a8d4', '#86efac', '#93c5fd', '#fde68a', '#d8b4fe', '#fdba74']

interface Props {
  onSubmit?: (dataUrl: string) => void
  onBack: () => void
  title?: string
}

export function DrawingCanvas({ onSubmit, onBack, title = '随手画' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<Tool>('pencil')
  const [color, setColor] = useState('#1a1a1a')
  const [isDrawing, setIsDrawing] = useState(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  // undo/redo stacks: store canvas image data snapshots
  const undoStack = useRef<ImageData[]>([])
  const redoStack = useRef<ImageData[]>([])
  const colorInputRef = useRef<HTMLInputElement>(null)
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.getContext('2d')
  }, [])

  const snapshot = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = getCtx()
    if (!canvas || !ctx) return
    undoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
    redoStack.current = []
    setHistoryState({ canUndo: undoStack.current.length > 1, canRedo: false })
  }, [getCtx])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = getCtx()
    if (!canvas || !ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // Save initial state
    undoStack.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)]
    redoStack.current = []
    setHistoryState({ canUndo: false, canRedo: false })
  }, [getCtx])

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const applyTool = useCallback((ctx: CanvasRenderingContext2D, currentTool: Tool, col: string) => {
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
      ctx.lineWidth = 18
    } else if (currentTool === 'pen') {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = col
      ctx.lineWidth = 6
    } else {
      // pencil
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = col
      ctx.lineWidth = 2.5
    }
  }, [])

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (tool === 'hand' || tool === 'lasso' || tool === 'fill' || tool === 'pressure') return
    setIsDrawing(true)
    const pos = getPos(e)
    lastPos.current = pos
    // Draw a dot on click
    const ctx = getCtx()
    if (!ctx) return
    applyTool(ctx, tool, color)
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, ctx.lineWidth / 2, 0, Math.PI * 2)
    ctx.fillStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
    } else {
      ctx.fill()
    }
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing || !lastPos.current) return
    const ctx = getCtx()
    if (!ctx) return
    applyTool(ctx, tool, color)
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
  }

  const endDraw = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    lastPos.current = null
    const ctx = getCtx()
    if (ctx) {
      ctx.globalCompositeOperation = 'source-over'
      snapshot()
    }
  }

  const undo = () => {
    const canvas = canvasRef.current
    const ctx = getCtx()
    if (!canvas || !ctx || undoStack.current.length <= 1) return
    redoStack.current.push(undoStack.current.pop()!)
    ctx.putImageData(undoStack.current[undoStack.current.length - 1], 0, 0)
    setHistoryState({
      canUndo: undoStack.current.length > 1,
      canRedo: redoStack.current.length > 0,
    })
  }

  const redo = () => {
    const canvas = canvasRef.current
    const ctx = getCtx()
    if (!canvas || !ctx || redoStack.current.length === 0) return
    const next = redoStack.current.pop()!
    undoStack.current.push(next)
    ctx.putImageData(next, 0, 0)
    setHistoryState({
      canUndo: undoStack.current.length > 1,
      canRedo: redoStack.current.length > 0,
    })
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = getCtx()
    if (!canvas || !ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    snapshot()
  }

  const handleSubmit = () => {
    const canvas = canvasRef.current
    if (!canvas || !onSubmit) return
    // Ensure white background before export
    const offscreen = document.createElement('canvas')
    offscreen.width = canvas.width
    offscreen.height = canvas.height
    const offCtx = offscreen.getContext('2d')!
    offCtx.fillStyle = '#ffffff'
    offCtx.fillRect(0, 0, offscreen.width, offscreen.height)
    offCtx.drawImage(canvas, 0, 0)
    onSubmit(offscreen.toDataURL('image/png'))
  }

  const { canUndo, canRedo } = historyState

  const toolDefs: { id: Tool; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { id: 'pencil', label: '铅笔', icon: <PencilIcon /> },
    { id: 'eraser', label: '橡皮', icon: <EraserIcon /> },
    { id: 'pen', label: '钢笔', icon: <PenIcon /> },
    { id: 'fill', label: '填充', icon: <FillIcon />, disabled: true },
    { id: 'hand', label: '移动', icon: <HandIcon />, disabled: true },
    { id: 'lasso', label: '套索', icon: <LassoIcon />, disabled: true },
    { id: 'pressure', label: '压感', icon: <PressureIcon />, disabled: true },
  ]

  return (
    <div className="flex flex-col h-full" style={{ background: '#f5f0e8' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <span className="text-2xl font-bold" style={{ fontFamily: 'serif' }}>{title}</span>
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm border-2 border-gray-800 rounded-lg"
          style={{ boxShadow: '2px 2px 0 #1a1a1a' }}
        >
          返回
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center px-4 pb-2 min-h-0">
        <canvas
          ref={canvasRef}
          width={600}
          height={420}
          className="rounded-2xl border-2 border-gray-800 touch-none"
          style={{
            background: '#ffffff',
            cursor: tool === 'eraser' ? 'cell' : tool === 'hand' ? 'grab' : 'crosshair',
            maxWidth: '100%',
            maxHeight: '100%',
            display: 'block',
          }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-3 pb-4 px-4">
        {/* Color row */}
        <div className="flex items-center gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); if (tool === 'eraser') setTool('pencil') }}
              className="rounded-full border-2 transition-transform hover:scale-110"
              style={{
                width: 32, height: 32,
                background: c,
                borderColor: color === c ? '#1a1a1a' : 'transparent',
                boxShadow: color === c ? '0 0 0 2px #fff inset' : 'none',
              }}
            />
          ))}
          {/* Custom color picker */}
          <button
            onClick={() => colorInputRef.current?.click()}
            className="rounded-full border-2 border-transparent hover:scale-110 transition-transform overflow-hidden"
            style={{ width: 32, height: 32, background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
          />
          <input
            ref={colorInputRef}
            type="color"
            className="sr-only"
            value={color}
            onChange={(e) => { setColor(e.target.value); if (tool === 'eraser') setTool('pencil') }}
          />
        </div>

        {/* Tools row */}
        <div className="flex items-center gap-1.5">
          {toolDefs.map(({ id, label, icon, disabled }) => (
            <button
              key={id}
              title={label}
              disabled={disabled}
              onClick={() => !disabled && setTool(id)}
              className="w-11 h-11 flex items-center justify-center rounded-xl border-2 transition-all"
              style={{
                background: tool === id ? '#fde68a' : '#ffffff',
                borderColor: tool === id ? '#1a1a1a' : '#d0d0d0',
                boxShadow: tool === id ? '2px 2px 0 #1a1a1a' : 'none',
                opacity: disabled ? 0.35 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {icon}
            </button>
          ))}

          {/* Separator */}
          <div style={{ width: 1, height: 28, background: '#d0d0d0', margin: '0 4px' }} />

          {/* Undo */}
          <button
            title="撤销"
            onClick={undo}
            disabled={!canUndo}
            className="w-11 h-11 flex items-center justify-center rounded-xl border-2 border-gray-200 transition-all"
            style={{ opacity: canUndo ? 1 : 0.35, cursor: canUndo ? 'pointer' : 'not-allowed' }}
          >
            <UndoIcon />
          </button>

          {/* Redo */}
          <button
            title="重做"
            onClick={redo}
            disabled={!canRedo}
            className="w-11 h-11 flex items-center justify-center rounded-xl border-2 border-gray-200 transition-all"
            style={{ opacity: canRedo ? 1 : 0.35, cursor: canRedo ? 'pointer' : 'not-allowed' }}
          >
            <RedoIcon />
          </button>

          {/* Clear */}
          <button
            title="清除"
            onClick={clear}
            className="w-11 h-11 flex items-center justify-center rounded-xl border-2 border-red-200 bg-red-100 transition-all hover:bg-red-200"
          >
            <TrashIcon />
          </button>
        </div>

        {/* Submit button — only shown when onSubmit is provided */}
        {onSubmit && (
          <button
            onClick={handleSubmit}
            className="w-full py-3 rounded-xl text-sm font-medium text-white"
            style={{ background: '#1a1a1a', maxWidth: 400 }}
          >
            提交图片
          </button>
        )}
      </div>
    </div>
  )
}

function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
    </svg>
  )
}

function EraserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/>
      <path d="M22 21H7"/>
      <path d="m5 11 9 9"/>
    </svg>
  )
}

function PenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
    </svg>
  )
}

function FillIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m19 11-8-8-8.5 8.5a5.5 5.5 0 0 0 7.78 7.78L19 11Z"/>
      <path d="m19 11 2-2 1 1-2 2"/>
      <path d="M18 12c.5 2.5-.17 5-2 6.5"/>
    </svg>
  )
}

function HandIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
      <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
      <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
    </svg>
  )
}

function LassoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 22a5 5 0 0 1-2-4"/>
      <path d="M7 16.93c.96.43 1.96.74 2.99.91"/>
      <path d="M3.34 14A6.8 6.8 0 0 1 2 10c0-4.42 4.48-8 10-8s10 3.58 10 8a7.19 7.19 0 0 1-.33 2"/>
      <path d="M5 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
    </svg>
  )
}

function PressureIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 8c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8Z"/>
      <path d="M15 2v4"/>
      <path d="M9 2v4"/>
      <path d="M5 16v4"/>
      <path d="M19 16v4"/>
    </svg>
  )
}

function UndoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v6h6"/>
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
    </svg>
  )
}

function RedoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 7v6h-6"/>
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/>
      <path d="M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  )
}
