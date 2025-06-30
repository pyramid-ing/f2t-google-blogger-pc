import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  Card,
  Button,
  Select,
  Slider,
  ColorPicker,
  Space,
  Typography,
  Input,
  InputNumber,
  Form,
  Upload,
  message,
} from 'antd'
import { AppstoreOutlined, SaveOutlined, PlusOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { Stage, Layer, Text as KonvaText, Image as KonvaImage, Transformer, Line } from 'react-konva'
import { TextElement, ThumbnailLayout, EditorState } from '../../types/thumbnail'
import { thumbnailApi } from '../../api'
import Konva from 'konva'
import useImage from 'use-image'

// 웹 폰트 로딩을 위한 CSS 스타일
const fontStyles = `
  @import url('http://fonts.googleapis.com/earlyaccess/nanumgothic.css');
  @import url('https://cdn.rawgit.com/moonspam/NanumSquare/master/nanumsquare.css');
  
  @font-face {
    font-family: 'BMDOHYEON';
    src: url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/BMDOHYEON.woff') format('woff');
    font-weight: normal;
    font-style: normal;
  }
`

const { Option } = Select
const { Text } = Typography
const { TextArea } = Input

interface ThumbnailEditorProps {
  initialLayout?: ThumbnailLayout
  initialName?: string
  initialDescription?: string
  onSave: (layout: ThumbnailLayout, name: string, description?: string) => void
  onCancel: () => void
  isCreatingNew?: boolean
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
  isEditing: boolean
  onSelect: () => void
  onTransform: (id: string, attrs: any) => void
  onDoubleClick: () => void
  fontsLoaded: boolean
}> = ({ element, isSelected, isEditing, onSelect, onTransform, onDoubleClick, fontsLoaded }) => {
  const textRef = useRef<Konva.Text>(null)
  const transformerRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    if (isSelected && transformerRef.current && textRef.current) {
      transformerRef.current.nodes([textRef.current])
      transformerRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected])

  const handleSelect = (e: any) => {
    console.log('텍스트 클릭됨:', element.id)
    e.cancelBubble = true // 이벤트 버블링 중단
    onSelect()
  }

  const handleDoubleClick = (e: any) => {
    console.log('텍스트 더블클릭됨:', element.id)
    e.cancelBubble = true // 이벤트 버블링 중단
    onDoubleClick()
  }

  return (
    <>
      <KonvaText
        key={`${element.id}-${element.fontFamily}-${fontsLoaded}`}
        ref={textRef}
        x={element.x}
        y={element.y}
        text={element.text}
        fontSize={element.fontSize}
        fontFamily={element.fontFamily}
        fill={element.color}
        opacity={isEditing ? 0.3 : element.opacity}
        align={element.textAlign}
        draggable={!isEditing}
        onClick={handleSelect}
        onTap={handleSelect}
        onDblClick={handleDoubleClick}
        onDbltap={handleDoubleClick}
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

          const newFontSize = element.fontSize * Math.max(scaleX, scaleY)
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
  const step = 50

  for (let i = 0; i <= 1000; i += step) {
    gridLines.push(<Line key={`v-${i}`} points={[i, 0, i, 1000]} stroke="#e8e8e8" strokeWidth={1} listening={false} />)
  }

  for (let i = 0; i <= 1000; i += step) {
    gridLines.push(<Line key={`h-${i}`} points={[0, i, 1000, i]} stroke="#e8e8e8" strokeWidth={1} listening={false} />)
  }

  return <>{gridLines}</>
}

const ThumbnailEditor: React.FC<ThumbnailEditorProps> = ({
  initialLayout,
  initialName,
  initialDescription,
  onSave,
  onCancel,
  isCreatingNew = false,
}) => {
  const [form] = Form.useForm()
  const stageRef = useRef<Konva.Stage>(null)

  const createDefaultLayout = (): ThumbnailLayout => ({
    id: Date.now().toString(),
    backgroundImage: '',
    elements: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const [layout, setLayout] = useState<ThumbnailLayout>(initialLayout || createDefaultLayout())
  const [backgroundImageBase64, setBackgroundImageBase64] = useState<string>('')
  const [fontsLoaded, setFontsLoaded] = useState<boolean>(false)
  const [editorState, setEditorState] = useState<EditorState>({
    selectedElementId: null,
    isDragging: false,
    isResizing: false,
    zoom: 0.6,
    showGrid: true,
    snapToGrid: false,
  })

  // 텍스트 인라인 편집 상태
  const [editingElementId, setEditingElementId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState<string>('')
  const [editingPosition, setEditingPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // 클립보드 상태
  const [clipboardElement, setClipboardElement] = useState<TextElement | null>(null)

  // 히스토리 상태 (Undo/Redo)
  const [history, setHistory] = useState<ThumbnailLayout[]>([])
  const [historyIndex, setHistoryIndex] = useState<number>(-1)

  const fontFamilyOptions = [
    { value: 'BMDOHYEON', label: '배민 도현체' },
    { value: 'NanumGothic', label: '나눔고딕' },
    { value: 'NanumSquare', label: '나눔스퀘어' },
  ]

  // 폰트 로딩
  useEffect(() => {
    const loadFonts = async () => {
      try {
        // CSS 스타일 추가
        if (!document.getElementById('thumbnail-fonts')) {
          const style = document.createElement('style')
          style.id = 'thumbnail-fonts'
          style.innerHTML = fontStyles
          document.head.appendChild(style)
        }

        // 폰트 로딩 대기
        if ('fonts' in document) {
          await Promise.all([
            document.fonts.load('1em BMDOHYEON'),
            document.fonts.load('1em NanumGothic'),
            document.fonts.load('1em NanumSquare'),
          ])
        }

        // 폰트 로딩 완료 후 잠시 대기
        setTimeout(() => {
          setFontsLoaded(true)
          console.log('폰트 로딩 완료')
        }, 1000)
      } catch (error) {
        console.error('폰트 로딩 실패:', error)
        setFontsLoaded(true) // 실패해도 계속 진행
      }
    }

    loadFonts()
  }, [])

  // 초기값 설정
  useEffect(() => {
    if (initialLayout) {
      setLayout(initialLayout)
      // 배경 이미지가 있으면 로드
      if (initialLayout.backgroundImage) {
        loadBackgroundImage(initialLayout.backgroundImage)
      }
    }

    // 편집 모드일 때 폼 초기값 설정
    if (!isCreatingNew) {
      form.setFieldsValue({
        name: initialName || '',
        description: initialDescription || '',
      })
    }
  }, [initialLayout, initialName, initialDescription, isCreatingNew, form])

  // 히스토리 초기값 설정
  useEffect(() => {
    if (layout && history.length === 0) {
      setHistory([{ ...layout }])
      setHistoryIndex(0)
    }
  }, [layout, history.length])

  const loadBackgroundImage = async (backgroundImage: string) => {
    if (!backgroundImage) return

    try {
      const result = await thumbnailApi.getBackgroundImage(backgroundImage)
      if (result.success && result.base64) {
        setBackgroundImageBase64(result.base64)
      }
    } catch (error) {
      console.error('배경 이미지 로드 실패:', error)
    }
  }

  // 텍스트 요소 추가
  const addTextElement = useCallback(() => {
    const newElement: TextElement = {
      id: Date.now().toString(),
      text: '텍스트를 입력하세요',
      x: 100,
      y: 200 + layout.elements.length * 100, // 요소마다 Y 위치 조정
      width: 400,
      height: 60,
      fontSize: 48,
      fontFamily: 'BMDOHYEON',
      color: '#000000',
      textAlign: 'left',
      fontWeight: 'bold',
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
  }, [layout.elements.length])

  // 요소 선택
  const selectElement = useCallback((elementId: string | null) => {
    console.log('선택된 요소 ID:', elementId)

    setEditorState(prev => ({
      ...prev,
      selectedElementId: elementId,
    }))
  }, [])

  // 요소 변형
  const transformElement = useCallback((elementId: string, attrs: Partial<TextElement>) => {
    console.log('요소 변형:', elementId, attrs)
    setLayout(prev => ({
      ...prev,
      elements: prev.elements.map(el => {
        if (el.id === elementId) {
          const updated = { ...el, ...attrs }
          console.log('업데이트된 요소:', updated)
          return updated
        }
        return el
      }),
    }))

    // 폰트 변경 시 stage 강제 업데이트
    if (attrs.fontFamily && stageRef.current) {
      setTimeout(() => {
        try {
          stageRef.current?.batchDraw()
          console.log('Stage 강제 업데이트 완료')
        } catch (error) {
          console.error('Stage 업데이트 실패:', error)
        }
      }, 100)
    }
  }, [])

  // 요소 삭제
  const deleteElement = useCallback((elementId: string) => {
    setLayout(prev => ({
      ...prev,
      elements: prev.elements.filter(el => el.id !== elementId),
    }))
    setEditorState(prev => ({
      ...prev,
      selectedElementId: null,
    }))
  }, [])

  // 텍스트 편집 시작
  const startTextEditing = useCallback(
    (elementId: string) => {
      // 이미 편집 중이면 이전 편집 완료
      if (editingElementId && editingElementId !== elementId) {
        transformElement(editingElementId, { text: editingText })
      }

      const element = layout.elements.find(el => el.id === elementId)
      if (element && stageRef.current) {
        const stage = stageRef.current
        const stageBox = stage.container().getBoundingClientRect()

        setEditingElementId(elementId)
        setEditingText(element.text)
        setEditingPosition({
          x: stageBox.left + element.x * editorState.zoom + 10,
          y: stageBox.top + element.y * editorState.zoom + 10,
        })
      }
    },
    [layout.elements, editorState.zoom, editingElementId, editingText, transformElement],
  )

  // 텍스트 편집 완료
  const finishTextEditing = useCallback(() => {
    if (editingElementId) {
      transformElement(editingElementId, { text: editingText })
      setEditingElementId(null)
      setEditingText('')
    }
  }, [editingElementId, editingText, transformElement])

  // 텍스트 편집 취소
  const cancelTextEditing = useCallback(() => {
    setEditingElementId(null)
    setEditingText('')
  }, [])

  // 히스토리에 현재 상태 추가
  const addToHistory = useCallback(
    (newLayout: ThumbnailLayout) => {
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1)
        newHistory.push({ ...newLayout })
        // 히스토리 크기 제한 (최대 50개)
        if (newHistory.length > 50) {
          newHistory.shift()
          return newHistory
        }
        return newHistory
      })
      setHistoryIndex(prev => Math.min(prev + 1, 49))
    },
    [historyIndex],
  )

  // 실행 취소
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevLayout = history[historyIndex - 1]
      setLayout(prevLayout)
      setHistoryIndex(prev => prev - 1)
      setEditorState(prev => ({ ...prev, selectedElementId: null }))
    }
  }, [history, historyIndex])

  // 다시 실행
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextLayout = history[historyIndex + 1]
      setLayout(nextLayout)
      setHistoryIndex(prev => prev + 1)
      setEditorState(prev => ({ ...prev, selectedElementId: null }))
    }
  }, [history, historyIndex])

  // 요소 복사
  const copyElement = useCallback(() => {
    const selectedElement = layout.elements.find(el => el.id === editorState.selectedElementId)
    if (selectedElement) {
      setClipboardElement({ ...selectedElement })
      console.log('요소 복사됨:', selectedElement.text)
    }
  }, [layout.elements, editorState.selectedElementId])

  // 요소 붙여넣기
  const pasteElement = useCallback(() => {
    if (clipboardElement) {
      const newElement: TextElement = {
        ...clipboardElement,
        id: Date.now().toString(),
        x: clipboardElement.x + 20, // 약간 오프셋
        y: clipboardElement.y + 20,
        zIndex: layout.elements.length + 1,
      }

      const newLayout = {
        ...layout,
        elements: [...layout.elements, newElement],
        updatedAt: new Date().toISOString(),
      }

      addToHistory(layout)
      setLayout(newLayout)
      setEditorState(prev => ({ ...prev, selectedElementId: newElement.id }))
      console.log('요소 붙여넣기됨:', newElement.text)
    }
  }, [clipboardElement, layout, addToHistory])

  // 요소 복제
  const duplicateElement = useCallback(() => {
    const selectedElement = layout.elements.find(el => el.id === editorState.selectedElementId)
    if (selectedElement) {
      const newElement: TextElement = {
        ...selectedElement,
        id: Date.now().toString(),
        x: selectedElement.x + 20,
        y: selectedElement.y + 20,
        zIndex: layout.elements.length + 1,
      }

      const newLayout = {
        ...layout,
        elements: [...layout.elements, newElement],
        updatedAt: new Date().toISOString(),
      }

      addToHistory(layout)
      setLayout(newLayout)
      setEditorState(prev => ({ ...prev, selectedElementId: newElement.id }))
      console.log('요소 복제됨:', newElement.text)
    }
  }, [layout, editorState.selectedElementId, addToHistory])

  // 선택된 요소 삭제 (키보드)
  const deleteSelectedElement = useCallback(() => {
    if (editorState.selectedElementId && !editingElementId) {
      addToHistory(layout)
      deleteElement(editorState.selectedElementId)
      console.log('요소 삭제됨 (키보드)')
    }
  }, [editorState.selectedElementId, editingElementId, layout, addToHistory, deleteElement])

  // 방향키로 요소 이동
  const moveElement = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right', distance: number = 5) => {
      if (editorState.selectedElementId && !editingElementId) {
        const deltaMap = {
          up: { x: 0, y: -distance },
          down: { x: 0, y: distance },
          left: { x: -distance, y: 0 },
          right: { x: distance, y: 0 },
        }

        const delta = deltaMap[direction]
        const element = layout.elements.find(el => el.id === editorState.selectedElementId)

        if (element) {
          const newX = Math.max(0, Math.min(1000 - element.width, element.x + delta.x))
          const newY = Math.max(0, Math.min(1000 - element.height, element.y + delta.y))

          transformElement(editorState.selectedElementId, { x: newX, y: newY })
        }
      }
    },
    [editorState.selectedElementId, editingElementId, layout.elements, transformElement],
  )

  // 선택된 요소 가져오기
  const selectedElement = layout.elements.find(el => el.id === editorState.selectedElementId)

  // 키보드 이벤트 처리 (모든 함수들이 선언된 후에 배치)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 편집 중이면 키보드 이벤트 무시 (Escape 제외)
      if (editingElementId && e.key !== 'Escape') {
        return
      }

      // Input, TextArea 등에서 입력 중이면 무시
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

      const isCtrl = e.ctrlKey || e.metaKey
      const isShift = e.shiftKey

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          e.preventDefault()
          deleteSelectedElement()
          break

        case 'c':
          if (isCtrl) {
            e.preventDefault()
            copyElement()
          }
          break

        case 'v':
          if (isCtrl) {
            e.preventDefault()
            pasteElement()
          }
          break

        case 'd':
          if (isCtrl) {
            e.preventDefault()
            duplicateElement()
          }
          break

        case 'z':
          if (isCtrl && !isShift) {
            e.preventDefault()
            undo()
          } else if (isCtrl && isShift) {
            e.preventDefault()
            redo()
          }
          break

        case 'y':
          if (isCtrl) {
            e.preventDefault()
            redo()
          }
          break

        case 'ArrowUp':
          e.preventDefault()
          moveElement('up', isShift ? 1 : 5)
          break

        case 'ArrowDown':
          e.preventDefault()
          moveElement('down', isShift ? 1 : 5)
          break

        case 'ArrowLeft':
          e.preventDefault()
          moveElement('left', isShift ? 1 : 5)
          break

        case 'ArrowRight':
          e.preventDefault()
          moveElement('right', isShift ? 1 : 5)
          break

        case 'Escape':
          if (editingElementId) {
            cancelTextEditing()
          } else if (editorState.selectedElementId) {
            setEditorState(prev => ({ ...prev, selectedElementId: null }))
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    editingElementId,
    editorState.selectedElementId,
    deleteSelectedElement,
    copyElement,
    pasteElement,
    duplicateElement,
    undo,
    redo,
    moveElement,
    cancelTextEditing,
  ])

  // 배경 이미지 업로드
  const handleBackgroundUpload = async (file: File) => {
    try {
      const result = await thumbnailApi.uploadBackgroundImage(file)
      if (result.success && result.fileName) {
        setLayout(prev => ({
          ...prev,
          backgroundImage: result.fileName,
        }))
        await loadBackgroundImage(result.fileName)
        message.success('배경 이미지가 업로드되었습니다.')
      } else {
        message.error(result.error || '배경 이미지 업로드에 실패했습니다.')
      }
    } catch (error) {
      console.error('배경 이미지 업로드 실패:', error)
      message.error('배경 이미지 업로드 중 오류가 발생했습니다.')
    }
  }

  // 저장 처리
  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const updatedLayout = {
        ...layout,
        updatedAt: new Date().toISOString(),
      }
      onSave(updatedLayout, values.name, values.description)
    } catch (error) {
      console.error('폼 검증 실패:', error)
    }
  }

  return (
    <div style={{ display: 'flex', height: '80vh' }}>
      {/* 좌측 도구 패널 */}
      <div style={{ width: '300px', padding: '16px', borderRight: '1px solid #f0f0f0', overflowY: 'auto' }}>
        {/* 레이아웃 정보 */}
        <Card title="레이아웃 정보" size="small" className="mb-4">
          <Form form={form} layout="vertical">
            <Form.Item
              name="name"
              label="레이아웃 이름"
              rules={[{ required: true, message: '레이아웃 이름을 입력해주세요' }]}
            >
              <Input placeholder="레이아웃 이름을 입력하세요" />
            </Form.Item>

            <Form.Item name="description" label="설명">
              <TextArea placeholder="레이아웃 설명을 입력하세요" rows={3} />
            </Form.Item>
          </Form>
        </Card>

        {/* 배경 설정 */}
        <Card title="배경 설정" size="small" className="mb-4">
          <Upload
            accept=".png,.jpg,.jpeg"
            showUploadList={false}
            beforeUpload={file => {
              handleBackgroundUpload(file)
              return false
            }}
          >
            <Button icon={<UploadOutlined />} block>
              배경 이미지 업로드
            </Button>
          </Upload>

          {backgroundImageBase64 && (
            <div className="mt-2">
              <img src={backgroundImageBase64} alt="배경 이미지" style={{ width: '100%', borderRadius: '4px' }} />
            </div>
          )}
        </Card>

        {/* 요소 추가 */}
        <Card title="요소 추가" size="small" className="mb-4">
          <Button icon={<PlusOutlined />} onClick={addTextElement} block>
            텍스트 추가
          </Button>
        </Card>

        {/* 템플릿 안내 */}
        <Card title="템플릿 사용법" size="small" className="mb-4">
          <div style={{ fontSize: '12px', color: '#666' }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>사용 가능한 템플릿:</strong>
            </div>
            <div style={{ marginBottom: '4px' }}>
              • <code>{'{{제목}}'}</code> - 제목으로 교체
            </div>
            <div style={{ marginBottom: '4px' }}>
              • <code>{'{{부제목}}'}</code> - 부제목으로 교체
            </div>
            <div style={{ marginBottom: '8px' }}>• 자유롭게 조합하여 사용 가능</div>
            <div style={{ fontSize: '11px', color: '#999' }}>
              <strong>예시:</strong>
              <br />
              <code>{'{{제목}} - {{부제목}}'}</code>
              <br />
              <code>{'메인: {{제목}}'}</code>
            </div>
          </div>
        </Card>

        {/* 요소 속성 */}
        {selectedElement && (
          <Card title="요소 속성" size="small" className="mb-4">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>텍스트</Text>
                <Input
                  value={selectedElement.text}
                  onChange={e => transformElement(selectedElement.id, { text: e.target.value })}
                  placeholder="예: {{제목}}, {{부제목}} 등 템플릿 사용 가능"
                />
              </div>

              <div>
                <Text strong>폰트 크기</Text>
                <InputNumber
                  min={12}
                  max={200}
                  step={1}
                  precision={0}
                  value={selectedElement.fontSize}
                  onChange={value => transformElement(selectedElement.id, { fontSize: value || 12 })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <Text strong>폰트 패밀리</Text>
                <Select
                  value={selectedElement.fontFamily}
                  onChange={value => transformElement(selectedElement.id, { fontFamily: value })}
                  style={{ width: '100%' }}
                >
                  {fontFamilyOptions.map(font => (
                    <Option key={font.value} value={font.value}>
                      {font.label}
                    </Option>
                  ))}
                </Select>
              </div>

              <div>
                <Text strong>색상</Text>
                <ColorPicker
                  value={selectedElement.color}
                  onChange={(color, hex) => transformElement(selectedElement.id, { color: hex })}
                />
              </div>

              <div>
                <Text strong>정렬</Text>
                <Select
                  value={selectedElement.textAlign}
                  onChange={value => transformElement(selectedElement.id, { textAlign: value })}
                  style={{ width: '100%' }}
                >
                  <Option value="left">왼쪽</Option>
                  <Option value="center">가운데</Option>
                  <Option value="right">오른쪽</Option>
                </Select>
              </div>

              <Button danger icon={<DeleteOutlined />} onClick={() => deleteElement(selectedElement.id)} block>
                요소 삭제
              </Button>
            </Space>
          </Card>
        )}

        {/* 에디터 설정 */}
        <Card title="에디터 설정" size="small" className="mb-4">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>확대/축소</Text>
              <Slider
                min={0.1}
                max={2}
                step={0.1}
                value={editorState.zoom}
                onChange={value => setEditorState(prev => ({ ...prev, zoom: value }))}
              />
            </div>

            <Button
              icon={<AppstoreOutlined />}
              onClick={() => setEditorState(prev => ({ ...prev, showGrid: !prev.showGrid }))}
              type={editorState.showGrid ? 'primary' : 'default'}
              block
            >
              격자 {editorState.showGrid ? '숨기기' : '보기'}
            </Button>
          </Space>
        </Card>

        {/* 키보드 단축키 안내 */}
        <Card title="키보드 단축키" size="small">
          <div style={{ fontSize: '11px', color: '#666' }}>
            <div style={{ marginBottom: '4px' }}>
              <strong>기본 조작:</strong>
            </div>
            <div style={{ marginBottom: '2px' }}>• 더블클릭: 텍스트 편집</div>
            <div style={{ marginBottom: '2px' }}>• Del/Backspace: 삭제</div>
            <div style={{ marginBottom: '2px' }}>• 방향키: 이동 (Shift+방향키: 1px씩)</div>
            <div style={{ marginBottom: '4px' }}>• Esc: 선택 해제</div>

            <div style={{ marginBottom: '4px' }}>
              <strong>편집:</strong>
            </div>
            <div style={{ marginBottom: '2px' }}>• Ctrl+C: 복사</div>
            <div style={{ marginBottom: '2px' }}>• Ctrl+V: 붙여넣기</div>
            <div style={{ marginBottom: '2px' }}>• Ctrl+D: 복제</div>
            <div style={{ marginBottom: '2px' }}>• Ctrl+Z: 실행취소</div>
            <div style={{ marginBottom: '2px' }}>• Ctrl+Y: 다시실행</div>
          </div>
        </Card>
      </div>

      {/* 우측 캔버스 */}
      <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '16px', textAlign: 'center' }}>
          <Space>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
              저장
            </Button>
            <Button onClick={onCancel}>취소</Button>
          </Space>
        </div>

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
          <Stage
            ref={stageRef}
            width={1000 * editorState.zoom}
            height={1000 * editorState.zoom}
            scaleX={editorState.zoom}
            scaleY={editorState.zoom}
            onClick={e => {
              // 편집 중이면 편집 완료
              if (editingElementId) {
                finishTextEditing()
                return
              }

              // 텍스트가 아닌 다른 요소를 클릭했을 때 선택 해제
              const targetType = e.target.nodeType || e.target.constructor.name
              if (targetType !== 'Text') {
                selectElement(null)
              }
            }}
          >
            <Layer>
              <Grid visible={editorState.showGrid} />

              {backgroundImageBase64 && <BackgroundImage imageUrl={backgroundImageBase64} />}

              {layout.elements.map(element => (
                <EditableText
                  key={element.id}
                  element={element}
                  isSelected={editorState.selectedElementId === element.id}
                  isEditing={element.id === editingElementId}
                  onSelect={() => selectElement(element.id)}
                  onTransform={transformElement}
                  onDoubleClick={() => startTextEditing(element.id)}
                  fontsLoaded={fontsLoaded}
                />
              ))}
            </Layer>
          </Stage>

          {/* 텍스트 인라인 편집 오버레이 */}
          {editingElementId && (
            <TextArea
              value={editingText}
              onChange={e => setEditingText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  finishTextEditing()
                } else if (e.key === 'Escape') {
                  cancelTextEditing()
                }
              }}
              onBlur={finishTextEditing}
              autoFocus
              autoSize={{ minRows: 2, maxRows: 6 }}
              style={{
                position: 'absolute',
                left: editingPosition.x,
                top: editingPosition.y,
                zIndex: 1000,
                minWidth: '250px',
                fontSize: '14px',
                border: '2px solid #1890ff',
                borderRadius: '4px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
              placeholder="텍스트 입력 (템플릿: {{제목}}, {{부제목}})&#10;Ctrl+Enter: 완료, Esc: 취소"
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default ThumbnailEditor
