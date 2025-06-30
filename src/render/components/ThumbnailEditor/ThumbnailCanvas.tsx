import React from 'react'
import { Stage, Layer } from 'react-konva'
import { Button, Space } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { BackgroundImage, EditableText, Grid } from './ThumbnailEditorComponents'
import { ThumbnailLayout, EditorState, TextElement } from '../../types/thumbnail'
import Konva from 'konva'

interface ThumbnailCanvasProps {
  layout: ThumbnailLayout
  backgroundImageBase64: string
  fontsLoaded: boolean
  editorState: EditorState
  editingElementId: string | null
  editingText: string
  editingPosition: { x: number; y: number }
  selectedElement: TextElement | null
  stageRef: React.RefObject<Konva.Stage>
  onSave: () => void
  onCancel: () => void
  onElementSelect: (id: string | null) => void
  onElementTransform: (id: string, attrs: any) => void
  onTextEditingStart: (id: string) => void
  onTextEditingChange: (value: string) => void
  onTextEditingFinish: () => void
  onTextEditingCancel: () => void
  onStageClick: (e: any) => void
}

export const ThumbnailCanvas: React.FC<ThumbnailCanvasProps> = ({
  layout,
  backgroundImageBase64,
  fontsLoaded,
  editorState,
  editingElementId,
  editingText,
  editingPosition,
  selectedElement,
  stageRef,
  onSave,
  onCancel,
  onElementSelect,
  onElementTransform,
  onTextEditingStart,
  onTextEditingChange,
  onTextEditingFinish,
  onTextEditingCancel,
  onStageClick,
}) => {
  return (
    <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column' }}>
      {/* 상단 버튼 */}
      <div style={{ marginBottom: '16px', textAlign: 'center' }}>
        <Space>
          <Button type="primary" icon={<SaveOutlined />} onClick={onSave}>
            저장
          </Button>
          <Button onClick={onCancel}>취소</Button>
        </Space>
      </div>

      {/* 캔버스 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          border: '1px solid #f0f0f0',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <Stage ref={stageRef} width={1000} height={1000} onClick={onStageClick}>
          <Layer>
            <Grid visible={editorState.showGrid} />

            {backgroundImageBase64 && <BackgroundImage imageUrl={backgroundImageBase64} />}

            {layout.elements.map(element => (
              <EditableText
                key={element.id}
                element={element}
                isSelected={editorState.selectedElementId === element.id}
                isEditing={element.id === editingElementId}
                onSelect={() => onElementSelect(element.id)}
                onTransform={onElementTransform}
                onDoubleClick={() => onTextEditingStart(element.id)}
                fontsLoaded={fontsLoaded}
              />
            ))}
          </Layer>
        </Stage>

        {/* WYSIWYG 텍스트 편집 오버레이 */}
        {editingElementId &&
          (() => {
            const editingElement = layout.elements.find(el => el.id === editingElementId)
            if (!editingElement || !stageRef.current) return null

            const stage = stageRef.current
            const scale = stage.scaleX()

            return (
              <textarea
                value={editingText}
                onChange={e => onTextEditingChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault()
                    onTextEditingFinish()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    onTextEditingCancel()
                  }
                }}
                onBlur={onTextEditingFinish}
                autoFocus
                style={{
                  position: 'absolute',
                  left: editingPosition.x,
                  top: editingPosition.y,
                  width: editingElement.width * scale,
                  height: editingElement.height * scale,
                  zIndex: 1000,
                  fontSize: `${editingElement.fontSize * scale}px`,
                  fontFamily: editingElement.fontFamily,
                  color: editingElement.color,
                  textAlign: editingElement.textAlign,
                  lineHeight: '1.2',
                  border: 'none',
                  background: 'transparent',
                  outline: '1px dashed #1890ff',
                  outlineOffset: '2px',
                  padding: '0',
                  margin: '0',
                  resize: 'none',
                  overflow: 'hidden',
                  wordWrap: 'break-word',
                  whiteSpace: 'pre-wrap',
                  boxSizing: 'border-box',
                }}
                placeholder="텍스트를 입력하세요..."
              />
            )
          })()}
      </div>
    </div>
  )
}
