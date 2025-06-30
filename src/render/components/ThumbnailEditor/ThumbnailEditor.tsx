import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Card, Button, Select, Slider, ColorPicker, Space, Typography, Input, Form, Upload, message } from 'antd'
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
  onSelect: () => void
  onTransform: (id: string, attrs: any) => void
  fontsLoaded: boolean
}> = ({ element, isSelected, onSelect, onTransform, fontsLoaded }) => {
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
        opacity={element.opacity}
        align={element.textAlign}
        draggable
        onClick={handleSelect}
        onTap={handleSelect}
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

  // 요소 추가
  const addTextElement = useCallback(
    (type: 'title' | 'subtitle') => {
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
    },
    [layout.elements.length],
  )

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

  // 선택된 요소 가져오기
  const selectedElement = layout.elements.find(el => el.id === editorState.selectedElementId)

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
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button icon={<PlusOutlined />} onClick={() => addTextElement('title')} block>
              제목 텍스트 추가
            </Button>
            <Button icon={<PlusOutlined />} onClick={() => addTextElement('subtitle')} block>
              부제목 텍스트 추가
            </Button>
          </Space>
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
                  placeholder="텍스트를 입력하세요"
                />
              </div>

              <div>
                <Text strong>폰트 크기</Text>
                <Slider
                  min={12}
                  max={100}
                  value={selectedElement.fontSize}
                  onChange={value => transformElement(selectedElement.id, { fontSize: value })}
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
        <Card title="에디터 설정" size="small">
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
                  onSelect={() => selectElement(element.id)}
                  onTransform={transformElement}
                  fontsLoaded={fontsLoaded}
                />
              ))}
            </Layer>
          </Stage>
        </div>
      </div>
    </div>
  )
}

export default ThumbnailEditor
