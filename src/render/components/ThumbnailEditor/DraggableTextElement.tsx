import React, { useState, useRef, useCallback } from 'react'
import { TextElement } from '../../types/thumbnail'

interface DraggableTextElementProps {
  element: TextElement
  isSelected: boolean
  onSelect: () => void
  onDrag: (elementId: string, x: number, y: number) => void
  onResize: (elementId: string, width: number, height: number) => void
  snapToGrid?: boolean
}

const DraggableTextElement: React.FC<DraggableTextElementProps> = ({
  element,
  isSelected,
  onSelect,
  onDrag,
  onResize,
  snapToGrid = true,
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ width: 0, height: 0 })
  const elementRef = useRef<HTMLDivElement>(null)

  // 그리드에 스냅하는 함수
  const snapToGridValue = useCallback(
    (value: number) => {
      if (!snapToGrid) return value
      const gridSize = 5 // 5% 간격
      return Math.round(value / gridSize) * gridSize
    },
    [snapToGrid],
  )

  // 드래그 시작
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== e.currentTarget) return // 리사이즈 핸들이 아닌 경우만

      e.stopPropagation()
      onSelect()

      setIsDragging(true)
      setDragStart({
        x: e.clientX - (element.x * window.innerWidth) / 100,
        y: e.clientY - (element.y * window.innerHeight) / 100,
      })

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return

        const parentRect = elementRef.current?.parentElement?.getBoundingClientRect()
        if (!parentRect) return

        const newX = ((e.clientX - dragStart.x) / parentRect.width) * 100
        const newY = ((e.clientY - dragStart.y) / parentRect.height) * 100

        const clampedX = Math.max(0, Math.min(100 - element.width, snapToGridValue(newX)))
        const clampedY = Math.max(0, Math.min(100 - element.height, snapToGridValue(newY)))

        onDrag(element.id, clampedX, clampedY)
      }

      const handleMouseUp = () => {
        setIsDragging(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [element, isDragging, dragStart, onDrag, onSelect, snapToGridValue],
  )

  // 리사이즈 핸들 처리
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, corner: string) => {
      e.stopPropagation()

      setIsResizing(true)
      setResizeStart({
        width: element.width,
        height: element.height,
      })

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing) return

        const parentRect = elementRef.current?.parentElement?.getBoundingClientRect()
        if (!parentRect) return

        const deltaX = (e.movementX / parentRect.width) * 100
        const deltaY = (e.movementY / parentRect.height) * 100

        let newWidth = resizeStart.width
        let newHeight = resizeStart.height

        if (corner.includes('e')) newWidth += deltaX
        if (corner.includes('w')) newWidth -= deltaX
        if (corner.includes('s')) newHeight += deltaY
        if (corner.includes('n')) newHeight -= deltaY

        // 최소/최대 크기 제한
        newWidth = Math.max(10, Math.min(100 - element.x, snapToGridValue(newWidth)))
        newHeight = Math.max(5, Math.min(100 - element.y, snapToGridValue(newHeight)))

        onResize(element.id, newWidth, newHeight)
      }

      const handleMouseUp = () => {
        setIsResizing(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [element, isResizing, resizeStart, onResize, snapToGridValue],
  )

  return (
    <div
      ref={elementRef}
      className={`draggable-element ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{
        position: 'absolute',
        left: `${element.x}%`,
        top: `${element.y}%`,
        width: `${element.width}%`,
        height: `${element.height}%`,
        border: isSelected ? '2px solid #1890ff' : '1px dashed rgba(255,255,255,0.3)',
        color: element.color,
        fontSize: `${element.fontSize * 0.6}px`, // 에디터에서는 작게 표시
        fontFamily: element.fontFamily,
        textAlign: element.textAlign,
        fontWeight: element.fontWeight,
        opacity: element.opacity,
        cursor: isDragging ? 'grabbing' : 'grab',
        display: 'flex',
        alignItems: 'center',
        justifyContent:
          element.textAlign === 'center' ? 'center' : element.textAlign === 'right' ? 'flex-end' : 'flex-start',
        padding: '4px',
        textShadow: '1px 1px 2px rgba(0,0,0,0.7)',
        zIndex: isSelected ? 10 : element.zIndex,
        transform: `rotate(${element.rotation}deg)`,
        transition: isDragging || isResizing ? 'none' : 'all 0.2s ease',
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onClick={e => {
        e.stopPropagation()
        onSelect()
      }}
    >
      {/* 텍스트 내용 */}
      <div
        className="element-text"
        style={{
          width: '100%',
          height: '100%',
          wordBreak: 'break-word',
          overflow: 'hidden',
          lineHeight: '1.2',
        }}
      >
        {element.text || '텍스트를 입력하세요'}
      </div>

      {/* 리사이즈 핸들들 (선택된 상태에서만 표시) */}
      {isSelected && (
        <>
          {/* 모서리 핸들 */}
          <div
            className="resize-handle nw"
            onMouseDown={e => handleResizeStart(e, 'nw')}
            style={{
              position: 'absolute',
              top: '-6px',
              left: '-6px',
              width: '12px',
              height: '12px',
              background: '#1890ff',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'nw-resize',
              zIndex: 1001,
            }}
          />
          <div
            className="resize-handle ne"
            onMouseDown={e => handleResizeStart(e, 'ne')}
            style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              width: '12px',
              height: '12px',
              background: '#1890ff',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'ne-resize',
              zIndex: 1001,
            }}
          />
          <div
            className="resize-handle sw"
            onMouseDown={e => handleResizeStart(e, 'sw')}
            style={{
              position: 'absolute',
              bottom: '-6px',
              left: '-6px',
              width: '12px',
              height: '12px',
              background: '#1890ff',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'sw-resize',
              zIndex: 1001,
            }}
          />
          <div
            className="resize-handle se"
            onMouseDown={e => handleResizeStart(e, 'se')}
            style={{
              position: 'absolute',
              bottom: '-6px',
              right: '-6px',
              width: '12px',
              height: '12px',
              background: '#1890ff',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'se-resize',
              zIndex: 1001,
            }}
          />

          {/* 중간 핸들 */}
          <div
            className="resize-handle n"
            onMouseDown={e => handleResizeStart(e, 'n')}
            style={{
              position: 'absolute',
              top: '-6px',
              left: '50%',
              marginLeft: '-6px',
              width: '12px',
              height: '12px',
              background: '#1890ff',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'n-resize',
              zIndex: 1001,
            }}
          />
          <div
            className="resize-handle e"
            onMouseDown={e => handleResizeStart(e, 'e')}
            style={{
              position: 'absolute',
              right: '-6px',
              top: '50%',
              marginTop: '-6px',
              width: '12px',
              height: '12px',
              background: '#1890ff',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'e-resize',
              zIndex: 1001,
            }}
          />
          <div
            className="resize-handle s"
            onMouseDown={e => handleResizeStart(e, 's')}
            style={{
              position: 'absolute',
              bottom: '-6px',
              left: '50%',
              marginLeft: '-6px',
              width: '12px',
              height: '12px',
              background: '#1890ff',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 's-resize',
              zIndex: 1001,
            }}
          />
          <div
            className="resize-handle w"
            onMouseDown={e => handleResizeStart(e, 'w')}
            style={{
              position: 'absolute',
              left: '-6px',
              top: '50%',
              marginTop: '-6px',
              width: '12px',
              height: '12px',
              background: '#1890ff',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'w-resize',
              zIndex: 1001,
            }}
          />
        </>
      )}
    </div>
  )
}

export default DraggableTextElement
