import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  Card,
  Button,
  Select,
  Slider,
  ColorPicker,
  Row,
  Col,
  Space,
  Typography,
  Divider,
  Input,
  InputNumber,
} from 'antd'
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  AppstoreOutlined,
  SaveOutlined,
  EyeOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { Stage, Layer, Text as KonvaText, Image as KonvaImage, Transformer, Line } from 'react-konva'
import { TextElement, ThumbnailLayout, EditorState } from '../../types/thumbnail'
import Konva from 'konva'
import useImage from 'use-image'

const { Option } = Select
const { Text } = Typography

interface ThumbnailEditorProps {
  backgroundImage?: string
  onSave: (layout: ThumbnailLayout) => void
  onPreview: (layout: ThumbnailLayout) => void
  initialLayout?: ThumbnailLayout
}

// 배경 이미지 컴포넌트
const BackgroundImage: React.FC<{ imageUrl: string }> = ({ imageUrl }) => {
  const [image] = useImage(imageUrl)

  return <KonvaImage image={image} x={0} y={0} width={1000} height={1000} listening={false} />
}

// 텍스트 요소 컴포넌트
const EditableText: React.FC<{
  element: TextElement
  isSelected: boolean
  onSelect: () => void
  onTransform: (id: string, attrs: any) => void
}> = ({ element, isSelected, onSelect, onTransform }) => {
  const textRef = useRef<Konva.Text>(null)
  const transformerRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    if (isSelected && transformerRef.current && textRef.current) {
      transformerRef.current.nodes([textRef.current])
      transformerRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected])

  return (
    <>
      <KonvaText
        ref={textRef}
        x={element.x}
        y={element.y}
        text={element.text}
        fontSize={element.fontSize}
        fontFamily={element.fontFamily}
        fill={element.color}
        opacity={element.opacity}
        align={element.textAlign}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={e => {
          onTransform(element.id, {
            x: e.target.x(),
            y: e.target.y(),
          })
        }}
        onTransformEnd={e => {
          const node = e.target as Konva.Text
          const scaleX = node.scaleX()
          const scaleY = node.scaleY()

          // 스케일을 실제 폰트 크기로 변환
          const newFontSize = element.fontSize * Math.max(scaleX, scaleY)

          // 스케일 리셋
          node.scaleX(1)
          node.scaleY(1)

          onTransform(element.id, {
            x: node.x(),
            y: node.y(),
            fontSize: Math.max(12, Math.min(100, newFontSize)),
          })
        }}
      />
      {isSelected && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            // 최소 크기 제한
            if (newBox.width < 20 || newBox.height < 20) {
              return oldBox
            }
            return newBox
          }}
        />
      )}
    </>
  )
}

// 격자 그리드 컴포넌트
const Grid: React.FC<{ visible: boolean }> = ({ visible }) => {
  if (!visible) return null

  const gridLines = []
  const step = 50 // 50px 간격

  // 수직선
  for (let i = 0; i <= 1000; i += step) {
    gridLines.push(<Line key={`v-${i}`} points={[i, 0, i, 1000]} stroke="#e8e8e8" strokeWidth={1} listening={false} />)
  }

  // 수평선
  for (let i = 0; i <= 1000; i += step) {
    gridLines.push(<Line key={`h-${i}`} points={[0, i, 1000, i]} stroke="#e8e8e8" strokeWidth={1} listening={false} />)
  }

  return <>{gridLines}</>
}

const ThumbnailEditor: React.FC<ThumbnailEditorProps> = ({
  backgroundImage = '',
  onSave,
  onPreview,
  initialLayout,
}) => {
  const stageRef = useRef<Konva.Stage>(null)

  const createDefaultLayout = (): ThumbnailLayout => ({
    id: Date.now().toString(),
    backgroundImage,
    elements: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const [layout, setLayout] = useState<ThumbnailLayout>(initialLayout || createDefaultLayout())

  const [editorState, setEditorState] = useState<EditorState>({
    selectedElementId: null,
    isDragging: false,
    isResizing: false,
    zoom: 0.6,
    showGrid: true,
    snapToGrid: false,
  })

  const fontFamilyOptions = ['BMDOHYEON', 'NanumGothic', 'NanumSquare']

  // 요소 추가
  const addTextElement = useCallback((type: 'title' | 'subtitle') => {
    const newElement: TextElement = {
      id: Date.now().toString(),
      type,
      text: type === 'title' ? '제목을 입력하세요' : '부제목을 입력하세요',
      x: 100,
      y: type === 'title' ? 200 : 300,
      width: 400,
      height: type === 'title' ? 60 : 40,
      fontSize: type === 'title' ? 48 : 32,
      fontFamily: 'BMDOHYEON',
      color: '#000000',
      textAlign: 'left',
      fontWeight: type === 'title' ? 'bold' : 'normal',
      opacity: 1,
      rotation: 0,
      zIndex: layout.elements.length + 1,
    }

    setLayout(prev => ({
      ...prev,
      elements: [...prev.elements, newElement],
    }))

    setEditorState(prev => ({
      ...prev,
      selectedElementId: newElement.id,
    }))
  }, [])

  // 요소 선택
  const selectElement = useCallback((id: string | null) => {
    setEditorState(prev => ({
      ...prev,
      selectedElementId: id,
    }))
  }, [])

  // 요소 업데이트
  const updateElement = useCallback((id: string, updates: Partial<TextElement>) => {
    setLayout(prev => ({
      ...prev,
      elements: prev.elements.map(el => (el.id === id ? { ...el, ...updates } : el)),
    }))
  }, [])

  // 요소 삭제
  const deleteElement = useCallback((id: string) => {
    setLayout(prev => ({
      ...prev,
      elements: prev.elements.filter(el => el.id !== id),
    }))
    setEditorState(prev => ({
      ...prev,
      selectedElementId: null,
    }))
  }, [])

  // 줌 조절
  const handleZoom = useCallback((direction: 'in' | 'out') => {
    setEditorState(prev => {
      const zoomStep = 0.1
      const newZoom = direction === 'in' ? Math.min(prev.zoom + zoomStep, 2) : Math.max(prev.zoom - zoomStep, 0.2)

      return { ...prev, zoom: newZoom }
    })
  }, [])

  // 변형 처리
  const handleTransform = useCallback(
    (id: string, attrs: any) => {
      updateElement(id, attrs)
    },
    [updateElement],
  )

  // 스테이지 클릭 (선택 해제)
  const handleStageClick = useCallback(
    (e: any) => {
      // 빈 공간 클릭 시 선택 해제
      if (e.target === stageRef.current) {
        selectElement(null)
      }
    },
    [selectElement],
  )

  // 선택된 요소 찾기
  const selectedElement = layout.elements.find(el => el.id === editorState.selectedElementId)

  // 저장 및 미리보기
  const handleSave = useCallback(() => {
    onSave(layout)
  }, [layout, onSave])

  const handlePreview = useCallback(() => {
    onPreview(layout)
  }, [layout, onPreview])

  return (
    <div style={{ padding: 16 }}>
      {/* 툴바 */}
      <Card title="툴바" size="small" style={{ marginBottom: 16 }}>
        <Row align="middle" justify="space-between">
          <Col>
            <Space>
              <Button icon={<PlusOutlined />} onClick={() => addTextElement('title')}>
                제목 추가
              </Button>
              <Button icon={<PlusOutlined />} onClick={() => addTextElement('subtitle')}>
                부제목 추가
              </Button>
              <Divider type="vertical" />
              <Button icon={<ZoomOutOutlined />} onClick={() => handleZoom('out')} disabled={editorState.zoom <= 0.2}>
                축소
              </Button>
              <Text>{Math.round(editorState.zoom * 100)}%</Text>
              <Button icon={<ZoomInOutlined />} onClick={() => handleZoom('in')} disabled={editorState.zoom >= 2}>
                확대
              </Button>
              <Divider type="vertical" />
              <Button
                icon={<AppstoreOutlined />}
                type={editorState.showGrid ? 'primary' : 'default'}
                onClick={() => setEditorState(prev => ({ ...prev, showGrid: !prev.showGrid }))}
              >
                격자
              </Button>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<EyeOutlined />} onClick={handlePreview}>
                미리보기
              </Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
                저장
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        {/* 속성 패널 */}
        <Col span={6}>
          <Card title="속성" size="small">
            {selectedElement ? (
              <div>
                <div style={{ marginBottom: 16, textAlign: 'center' }}>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => deleteElement(selectedElement.id)}
                    style={{ width: '100%' }}
                  >
                    요소 삭제
                  </Button>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <Text strong>텍스트</Text>
                  <Input
                    value={selectedElement.text}
                    onChange={e => updateElement(selectedElement.id, { text: e.target.value })}
                    style={{ marginTop: 4 }}
                    placeholder="텍스트를 입력하세요"
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <Text strong>폰트 크기: {selectedElement.fontSize}px</Text>
                  <Slider
                    min={12}
                    max={100}
                    value={selectedElement.fontSize}
                    onChange={value => updateElement(selectedElement.id, { fontSize: value })}
                    style={{ marginTop: 4 }}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <Text strong>폰트 패밀리</Text>
                  <Select
                    value={selectedElement.fontFamily}
                    onChange={value => updateElement(selectedElement.id, { fontFamily: value })}
                    style={{ width: '100%', marginTop: 4 }}
                  >
                    {fontFamilyOptions.map(font => (
                      <Option key={font} value={font}>
                        {font}
                      </Option>
                    ))}
                  </Select>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <Text strong>색상</Text>
                  <div style={{ marginTop: 4 }}>
                    <ColorPicker
                      value={selectedElement.color}
                      onChange={color => updateElement(selectedElement.id, { color: color.toHexString() })}
                      showText
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <Text strong>정렬</Text>
                  <Select
                    value={selectedElement.textAlign}
                    onChange={value => updateElement(selectedElement.id, { textAlign: value })}
                    style={{ width: '100%', marginTop: 4 }}
                  >
                    <Option value="left">왼쪽</Option>
                    <Option value="center">가운데</Option>
                    <Option value="right">오른쪽</Option>
                  </Select>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <Text strong>투명도: {Math.round(selectedElement.opacity * 100)}%</Text>
                  <Slider
                    min={0}
                    max={1}
                    step={0.1}
                    value={selectedElement.opacity}
                    onChange={value => updateElement(selectedElement.id, { opacity: value })}
                    style={{ marginTop: 4 }}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <Text strong>
                    위치 (X: {Math.round(selectedElement.x)}, Y: {Math.round(selectedElement.y)})
                  </Text>
                  <Row gutter={8} style={{ marginTop: 4 }}>
                    <Col span={12}>
                      <InputNumber
                        min={0}
                        max={1000}
                        value={Math.round(selectedElement.x)}
                        onChange={value => updateElement(selectedElement.id, { x: value || 0 })}
                        style={{ width: '100%' }}
                        addonBefore="X"
                      />
                    </Col>
                    <Col span={12}>
                      <InputNumber
                        min={0}
                        max={1000}
                        value={Math.round(selectedElement.y)}
                        onChange={value => updateElement(selectedElement.id, { y: value || 0 })}
                        style={{ width: '100%' }}
                        addonBefore="Y"
                      />
                    </Col>
                  </Row>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Text type="secondary">요소를 선택하거나 새로 추가하세요</Text>
                <div style={{ marginTop: 16 }}>
                  <Space direction="vertical">
                    <Button icon={<PlusOutlined />} onClick={() => addTextElement('title')} style={{ width: '100%' }}>
                      제목 추가
                    </Button>
                    <Button
                      icon={<PlusOutlined />}
                      onClick={() => addTextElement('subtitle')}
                      style={{ width: '100%' }}
                    >
                      부제목 추가
                    </Button>
                  </Space>
                </div>
              </div>
            )}
          </Card>
        </Col>

        {/* 캔버스 */}
        <Col span={18}>
          <Card title="에디터" size="small">
            <div
              style={{
                width: '100%',
                height: '600px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#f5f5f5',
                borderRadius: '8px',
                border: '2px solid #d9d9d9',
                overflow: 'hidden',
              }}
            >
              <Stage
                ref={stageRef}
                width={1000 * editorState.zoom}
                height={1000 * editorState.zoom}
                scaleX={editorState.zoom}
                scaleY={editorState.zoom}
                onClick={handleStageClick}
                onTap={handleStageClick}
                style={{
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              >
                <Layer>
                  {/* 배경 이미지 */}
                  {backgroundImage && <BackgroundImage imageUrl={`data:image/png;base64,${backgroundImage}`} />}

                  {/* 격자 */}
                  <Grid visible={editorState.showGrid} />

                  {/* 텍스트 요소들 */}
                  {layout.elements.map(element => (
                    <EditableText
                      key={element.id}
                      element={element}
                      isSelected={element.id === editorState.selectedElementId}
                      onSelect={() => selectElement(element.id)}
                      onTransform={handleTransform}
                    />
                  ))}
                </Layer>
              </Stage>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default ThumbnailEditor
