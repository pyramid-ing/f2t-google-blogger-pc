import React, { useState, useCallback, useRef } from 'react'
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
  UndoOutlined,
  RedoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  AppstoreOutlined,
  SaveOutlined,
  EyeOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { TextElement, ThumbnailLayout, EditorState } from '../../types/thumbnail'
import DraggableTextElement from './DraggableTextElement'
import './ThumbnailEditor.css'

const { Option } = Select
const { Text } = Typography

interface ThumbnailEditorProps {
  backgroundImage?: string
  onSave: (layout: ThumbnailLayout) => void
  onPreview: (layout: ThumbnailLayout) => void
  initialLayout?: ThumbnailLayout
}

const ThumbnailEditor: React.FC<ThumbnailEditorProps> = ({
  backgroundImage = '',
  onSave,
  onPreview,
  initialLayout,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null)

  // 기본 레이아웃
  const createDefaultLayout = (): ThumbnailLayout => ({
    id: Date.now().toString(),
    backgroundImage,
    elements: [
      {
        id: 'title-1',
        type: 'title',
        text: '제목을 입력하세요',
        x: 10,
        y: 30,
        width: 80,
        height: 20,
        fontSize: 48,
        fontFamily: 'BMDOHYEON',
        color: '#ffffff',
        textAlign: 'center',
        fontWeight: 'bold',
        opacity: 1,
        rotation: 0,
        zIndex: 1,
      },
      {
        id: 'subtitle-1',
        type: 'subtitle',
        text: '부제목을 입력하세요',
        x: 10,
        y: 55,
        width: 80,
        height: 15,
        fontSize: 28,
        fontFamily: 'BMDOHYEON',
        color: '#ffffff',
        textAlign: 'center',
        fontWeight: 'normal',
        opacity: 0.9,
        rotation: 0,
        zIndex: 2,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const [layout, setLayout] = useState<ThumbnailLayout>(initialLayout || createDefaultLayout())

  const [editorState, setEditorState] = useState<EditorState>({
    selectedElementId: null,
    isDragging: false,
    isResizing: false,
    zoom: 1,
    showGrid: true,
    snapToGrid: true,
  })

  const [history, setHistory] = useState({
    past: [] as ThumbnailLayout[],
    present: layout,
    future: [] as ThumbnailLayout[],
  })

  // 선택된 요소
  const selectedElement = layout.elements.find(el => el.id === editorState.selectedElementId)

  // 요소 업데이트
  const updateElement = useCallback((elementId: string, updates: Partial<TextElement>) => {
    setLayout(prev => ({
      ...prev,
      elements: prev.elements.map(el => (el.id === elementId ? { ...el, ...updates } : el)),
      updatedAt: new Date().toISOString(),
    }))
  }, [])

  // 요소 선택
  const selectElement = useCallback((elementId: string | null) => {
    setEditorState(prev => ({
      ...prev,
      selectedElementId: elementId,
    }))
  }, [])

  // 드래그 핸들러
  const handleDrag = useCallback(
    (elementId: string, x: number, y: number) => {
      updateElement(elementId, { x, y })
    },
    [updateElement],
  )

  // 리사이즈 핸들러
  const handleResize = useCallback(
    (elementId: string, width: number, height: number) => {
      updateElement(elementId, { width, height })
    },
    [updateElement],
  )

  // 텍스트 요소 추가
  const addTextElement = useCallback(
    (type: 'title' | 'subtitle') => {
      const newElement: TextElement = {
        id: `${type}-${Date.now()}`,
        type,
        text: type === 'title' ? '새 제목' : '새 부제목',
        x: 20,
        y: type === 'title' ? 30 : 50,
        width: 60,
        height: 15,
        fontSize: type === 'title' ? 48 : 32,
        fontFamily: 'BMDOHYEON',
        color: '#ffffff',
        textAlign: 'center',
        fontWeight: type === 'title' ? 'bold' : 'normal',
        opacity: 1,
        rotation: 0,
        zIndex: layout.elements.length + 1,
      }

      setLayout(prev => ({
        ...prev,
        elements: [...prev.elements, newElement],
        updatedAt: new Date().toISOString(),
      }))

      // 새로 추가된 요소 선택
      selectElement(newElement.id)
    },
    [layout.elements.length, selectElement],
  )

  // 요소 삭제
  const deleteElement = useCallback(
    (elementId: string) => {
      setLayout(prev => ({
        ...prev,
        elements: prev.elements.filter(el => el.id !== elementId),
        updatedAt: new Date().toISOString(),
      }))

      if (editorState.selectedElementId === elementId) {
        selectElement(null)
      }
    },
    [editorState.selectedElementId, selectElement],
  )

  // 폰트 패밀리 옵션
  const fontFamilyOptions = ['BMDOHYEON', 'Nanum Gothic', 'NanumSquare']

  return (
    <div className="thumbnail-editor">
      {/* 툴바 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Space>
              <Button icon={<UndoOutlined />} size="small" disabled={history.past.length === 0}>
                실행 취소
              </Button>
              <Button icon={<RedoOutlined />} size="small" disabled={history.future.length === 0}>
                다시 실행
              </Button>
            </Space>
          </Col>

          <Col>
            <Divider type="vertical" />
          </Col>

          <Col>
            <Space>
              <Button
                icon={<ZoomOutOutlined />}
                size="small"
                onClick={() => setEditorState(prev => ({ ...prev, zoom: Math.max(0.25, prev.zoom - 0.25) }))}
              />
              <Text style={{ minWidth: '60px', textAlign: 'center', display: 'inline-block' }}>
                {Math.round(editorState.zoom * 100)}%
              </Text>
              <Button
                icon={<ZoomInOutlined />}
                size="small"
                onClick={() => setEditorState(prev => ({ ...prev, zoom: Math.min(2, prev.zoom + 0.25) }))}
              />
            </Space>
          </Col>

          <Col>
            <Divider type="vertical" />
          </Col>

          <Col>
            <Button
              icon={<AppstoreOutlined />}
              size="small"
              type={editorState.showGrid ? 'primary' : 'default'}
              onClick={() => setEditorState(prev => ({ ...prev, showGrid: !prev.showGrid }))}
            >
              격자
            </Button>
          </Col>

          <Col>
            <Divider type="vertical" />
          </Col>

          <Col>
            <Space>
              <Button icon={<PlusOutlined />} size="small" onClick={() => addTextElement('title')}>
                제목 추가
              </Button>
              <Button icon={<PlusOutlined />} size="small" onClick={() => addTextElement('subtitle')}>
                부제목 추가
              </Button>
            </Space>
          </Col>

          <Col flex="auto">
            <div style={{ textAlign: 'right' }}>
              <Space>
                <Button icon={<EyeOutlined />} onClick={() => onPreview(layout)}>
                  미리보기
                </Button>
                <Button type="primary" icon={<SaveOutlined />} onClick={() => onSave(layout)}>
                  저장
                </Button>
              </Space>
            </div>
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        {/* 속성 패널 */}
        <Col span={6}>
          <Card title="속성" size="small">
            {selectedElement ? (
              <div>
                <div style={{ marginBottom: 16, padding: 8, backgroundColor: '#f0f0f0', borderRadius: 4 }}>
                  <Text strong>{selectedElement.type === 'title' ? '제목' : '부제목'} 요소</Text>
                  <div style={{ marginTop: 4, fontSize: '12px', color: '#666' }}>ID: {selectedElement.id}</div>
                  <Button
                    type="primary"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => deleteElement(selectedElement.id)}
                    style={{ marginTop: 8, width: '100%' }}
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
                    위치 (X: {Math.round(selectedElement.x)}%, Y: {Math.round(selectedElement.y)}%)
                  </Text>
                  <Row gutter={8} style={{ marginTop: 4 }}>
                    <Col span={12}>
                      <InputNumber
                        min={0}
                        max={100}
                        value={Math.round(selectedElement.x)}
                        onChange={value => updateElement(selectedElement.id, { x: value || 0 })}
                        style={{ width: '100%' }}
                        addonBefore="X"
                      />
                    </Col>
                    <Col span={12}>
                      <InputNumber
                        min={0}
                        max={100}
                        value={Math.round(selectedElement.y)}
                        onChange={value => updateElement(selectedElement.id, { y: value || 0 })}
                        style={{ width: '100%' }}
                        addonBefore="Y"
                      />
                    </Col>
                  </Row>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <Text strong>
                    크기 (W: {Math.round(selectedElement.width)}%, H: {Math.round(selectedElement.height)}%)
                  </Text>
                  <Row gutter={8} style={{ marginTop: 4 }}>
                    <Col span={12}>
                      <InputNumber
                        min={5}
                        max={100}
                        value={Math.round(selectedElement.width)}
                        onChange={value => updateElement(selectedElement.id, { width: value || 5 })}
                        style={{ width: '100%' }}
                        addonBefore="W"
                      />
                    </Col>
                    <Col span={12}>
                      <InputNumber
                        min={5}
                        max={100}
                        value={Math.round(selectedElement.height)}
                        onChange={value => updateElement(selectedElement.id, { height: value || 5 })}
                        style={{ width: '100%' }}
                        addonBefore="H"
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
              ref={canvasRef}
              className={`canvas-container ${editorState.showGrid ? 'show-grid' : ''}`}
              style={{
                width: '100%',
                height: '600px',
                position: 'relative',
                transform: `scale(${editorState.zoom})`,
                transformOrigin: 'top left',
                border: '2px solid #d9d9d9',
                borderRadius: '8px',
                backgroundImage: backgroundImage ? `url(data:image/png;base64,${backgroundImage})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: '#f5f5f5',
              }}
              onClick={() => selectElement(null)}
            >
              {layout.elements.map(element => (
                <DraggableTextElement
                  key={element.id}
                  element={element}
                  isSelected={element.id === editorState.selectedElementId}
                  onSelect={() => selectElement(element.id)}
                  onDrag={handleDrag}
                  onResize={handleResize}
                  snapToGrid={editorState.snapToGrid}
                />
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default ThumbnailEditor
