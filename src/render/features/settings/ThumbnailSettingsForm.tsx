import React, { useState, useEffect } from 'react'
import {
  Form,
  Button,
  Switch,
  Card,
  Input,
  Select,
  Upload,
  message,
  Row,
  Col,
  Image,
  Alert,
  Popconfirm,
  Typography,
  Modal,
} from 'antd'
import { EyeOutlined, UploadOutlined, DeleteOutlined, PictureOutlined } from '@ant-design/icons'
import { AppSettings } from '../../types/settings'
import { ThumbnailLayout } from '../../types/thumbnail'
import { thumbnailApi, BackgroundImageInfo } from '../../api'
import ThumbnailEditor from '../../components/ThumbnailEditor/ThumbnailEditor'
import { ThumbnailLayoutGenerateRequest } from '../../api/thumbnailApi'

const { Dragger } = Upload
const { Option } = Select
const { Text } = Typography
const { TextArea } = Input

interface ThumbnailSettingsFormProps {
  initialSettings?: AppSettings
  onSave: (settings: Partial<AppSettings>) => Promise<void>
}

export const ThumbnailSettingsForm: React.FC<ThumbnailSettingsFormProps> = ({ initialSettings = {}, onSave }) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [generatingPreview, setGeneratingPreview] = useState(false)
  const [uploadingBackground, setUploadingBackground] = useState(false)
  const [backgroundImages, setBackgroundImages] = useState<BackgroundImageInfo[]>([])
  const [previewImage, setPreviewImage] = useState<string>('')
  const [selectedBackgroundImage, setSelectedBackgroundImage] = useState<string>('')
  const [hoveredImage, setHoveredImage] = useState<string>('')
  const [currentBackgroundBase64, setCurrentBackgroundBase64] = useState<string>('')

  // 에디터 다이얼로그 상태 추가
  const [editorVisible, setEditorVisible] = useState<boolean>(false)

  // 에디터 관련 상태
  const [currentLayout, setCurrentLayout] = useState<ThumbnailLayout | undefined>()
  const [savedLayouts, setSavedLayouts] = useState<Record<string, ThumbnailLayout>>({}) // 배경별 레이아웃 저장

  // 폼 초기값 설정
  useEffect(() => {
    form.setFieldsValue({
      thumbnailEnabled: initialSettings.thumbnailEnabled || false,
      thumbnailBackgroundImage: initialSettings.thumbnailBackgroundImage || '',
    })

    setSelectedBackgroundImage(initialSettings.thumbnailBackgroundImage || '')
  }, [initialSettings, form])

  // 배경이미지 목록 로드
  useEffect(() => {
    loadBackgroundImages()
  }, [])

  // 선택된 배경 이미지 변경 시 base64 로드
  useEffect(() => {
    const loadBackgroundBase64 = async () => {
      if (selectedBackgroundImage) {
        try {
          const result = await thumbnailApi.getBackgroundImage(selectedBackgroundImage)
          if (result.success && result.base64) {
            setCurrentBackgroundBase64(result.base64)

            // 해당 배경에 저장된 레이아웃이 있으면 로드
            if (savedLayouts[selectedBackgroundImage]) {
              setCurrentLayout(savedLayouts[selectedBackgroundImage])
            } else {
              setCurrentLayout(undefined) // 새로운 배경이면 레이아웃 초기화
            }
          }
        } catch (error) {
          console.error('배경 이미지 로드 실패:', error)
          setCurrentBackgroundBase64('')
        }
      } else {
        setCurrentBackgroundBase64('')
        setCurrentLayout(undefined)
      }
    }

    loadBackgroundBase64()
  }, [selectedBackgroundImage, savedLayouts])

  const loadBackgroundImages = async () => {
    try {
      const result = await thumbnailApi.getBackgroundImages()
      if (result.success && result.images) {
        // 각 이미지의 base64 데이터를 가져옴
        const imagesWithBase64 = await Promise.all(
          result.images.map(async image => {
            try {
              const imageResult = await thumbnailApi.getBackgroundImage(image.fileName)
              return {
                ...image,
                base64: imageResult.success ? imageResult.base64 : undefined,
              }
            } catch (error) {
              console.error(`이미지 로드 실패: ${image.fileName}`, error)
              return image
            }
          }),
        )
        setBackgroundImages(imagesWithBase64)
      }
    } catch (error) {
      console.error('배경이미지 목록 로드 실패:', error)
    }
  }

  const handleSave = async () => {
    try {
      setLoading(true)
      const values = await form.validateFields()

      const settings: Partial<AppSettings> = {
        ...values,
        thumbnailBackgroundImage: selectedBackgroundImage,
      }

      await onSave(settings)
      message.success('썸네일 설정이 저장되었습니다.')
    } catch (error) {
      console.error('설정 저장 실패:', error)
      message.error('설정 저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const generatePreview = async () => {
    try {
      setGeneratingPreview(true)

      const result = await thumbnailApi.previewThumbnail({
        title: '썸네일 미리보기',
        subtitle: '설정된 스타일로 생성됩니다',
        backgroundImageFileName: selectedBackgroundImage,
      })

      if (result.success && result.base64) {
        setPreviewImage(result.base64)
        message.success('미리보기가 생성되었습니다.')
      } else {
        message.error(`미리보기 생성 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('미리보기 생성 실패:', error)
      message.error('미리보기 생성 중 오류가 발생했습니다.')
    } finally {
      setGeneratingPreview(false)
    }
  }

  const handleBackgroundImageUpload = async (file: File) => {
    try {
      setUploadingBackground(true)
      const result = await thumbnailApi.uploadBackgroundImage(file)

      if (result.success && result.fileName) {
        message.success('배경이미지 업로드가 완료되었습니다.')

        // 새로 업로드된 이미지의 base64 데이터를 가져와서 목록에 추가
        try {
          const imageResult = await thumbnailApi.getBackgroundImage(result.fileName)
          const newImage: BackgroundImageInfo = {
            fileName: result.fileName,
            filePath: '', // 실제 경로는 필요하지 않음
            base64: imageResult.success ? imageResult.base64 : undefined,
          }

          setBackgroundImages(prev => [...prev, newImage])
          setSelectedBackgroundImage(result.fileName)
          form.setFieldValue('thumbnailBackgroundImage', result.fileName)
        } catch (error) {
          // base64 로드에 실패해도 목록은 다시 로드
          await loadBackgroundImages()
          setSelectedBackgroundImage(result.fileName)
          form.setFieldValue('thumbnailBackgroundImage', result.fileName)
        }
      } else {
        message.error(`배경이미지 업로드 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('배경이미지 업로드 실패:', error)
      message.error('배경이미지 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploadingBackground(false)
    }
  }

  const handleDeleteBackgroundImage = async (fileName: string) => {
    try {
      const result = await thumbnailApi.deleteBackgroundImage(fileName)

      if (result.success) {
        message.success('배경이미지가 삭제되었습니다.')
        await loadBackgroundImages()

        if (selectedBackgroundImage === fileName) {
          setSelectedBackgroundImage('')
          form.setFieldValue('thumbnailBackgroundImage', '')
        }
      } else {
        message.error(`배경이미지 삭제 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('배경이미지 삭제 실패:', error)
      message.error('배경이미지 삭제 중 오류가 발생했습니다.')
    }
  }

  // 에디터 다이얼로그 닫기 처리
  const handleEditorClose = () => {
    setEditorVisible(false)
    // 에디터 닫을 때 현재 레이아웃 저장
    if (currentLayout && selectedBackgroundImage) {
      setSavedLayouts(prev => ({
        ...prev,
        [selectedBackgroundImage]: currentLayout,
      }))
    }
  }

  // 에디터 핸들러들
  const handleLayoutSave = (layout: ThumbnailLayout) => {
    // 배경별 레이아웃 저장
    setSavedLayouts(prev => ({
      ...prev,
      [selectedBackgroundImage]: layout,
    }))
    setCurrentLayout(layout)
    message.success('레이아웃이 저장되었습니다.')
  }

  const handleLayoutPreview = async (layout: ThumbnailLayout) => {
    if (!selectedBackgroundImage) {
      message.error('배경이미지를 먼저 선택해주세요.')
      return
    }

    try {
      setGeneratingPreview(true)

      // API 호출을 위한 데이터 변환
      const layoutRequest: ThumbnailLayoutGenerateRequest = {
        backgroundImageFileName: selectedBackgroundImage,
        layout: {
          id: layout.id,
          backgroundImage: selectedBackgroundImage,
          elements: layout.elements,
          createdAt: layout.createdAt,
          updatedAt: layout.updatedAt,
        },
        uploadToGCS: false,
      }

      const response = await thumbnailApi.previewThumbnailWithLayout(layoutRequest)

      if (response.success && response.base64) {
        setPreviewImage(response.base64)
        message.success('미리보기가 생성되었습니다!')
      } else {
        throw new Error(response.error || '미리보기 생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('미리보기 생성 실패:', error)
      message.error(`미리보기 생성 실패: ${error.message}`)
    } finally {
      setGeneratingPreview(false)
    }
  }

  // 배경 이미지 클릭 시 에디터로 이동
  const handleBackgroundImageClick = (fileName: string) => {
    setSelectedBackgroundImage(fileName)
    form.setFieldValue('thumbnailBackgroundImage', fileName)
    setEditorVisible(true)
    message.success('에디터에서 레이아웃을 편집해보세요!')
  }

  return (
    <div>
      <Card title="썸네일 설정" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="thumbnailEnabled" label="썸네일 생성 활성화" valuePropName="checked">
                <Switch />
              </Form.Item>

              <Alert
                message="썸네일 사이즈"
                description="썸네일은 1000x1000 픽셀 정사각형으로 생성됩니다."
                type="info"
                style={{ marginBottom: 16 }}
              />
            </Col>

            <Col span={12}>
              <div style={{ textAlign: 'center' }}>
                <Button
                  type="dashed"
                  icon={<EyeOutlined />}
                  onClick={generatePreview}
                  loading={generatingPreview}
                  style={{ marginBottom: 16 }}
                >
                  미리보기 생성
                </Button>

                {previewImage && (
                  <div>
                    <Image
                      src={previewImage}
                      alt="썸네일 미리보기"
                      style={{ maxWidth: '100%', border: '1px solid #d9d9d9' }}
                    />
                  </div>
                )}
              </div>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card title="썸네일 템플릿" style={{ marginBottom: 16 }}>
        <Alert
          message="썸네일 템플릿 선택"
          description="원하는 템플릿을 클릭하면 에디터가 열려 텍스트와 스타일을 자유롭게 편집할 수 있습니다."
          type="info"
          style={{ marginBottom: 16 }}
        />

        <Row gutter={24}>
          <Col span={12}>
            <Upload
              accept=".png,.jpg,.jpeg"
              showUploadList={false}
              beforeUpload={file => {
                handleBackgroundImageUpload(file)
                return false
              }}
            >
              <Button
                icon={<UploadOutlined />}
                loading={uploadingBackground}
                style={{ marginBottom: 16, width: '200px' }}
              >
                배경이미지 업로드
              </Button>
            </Upload>

            {backgroundImages.length > 0 && (
              <div>
                <Text strong style={{ marginBottom: 16, display: 'block' }}>
                  썸네일 템플릿 (클릭하면 에디터로 편집)
                </Text>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: '16px',
                    marginTop: '16px',
                  }}
                >
                  {backgroundImages.map(image => (
                    <div
                      key={image.fileName}
                      style={{
                        position: 'relative',
                        cursor: 'pointer',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border:
                          selectedBackgroundImage === image.fileName ? '3px solid #1890ff' : '3px solid transparent',
                        transition: 'all 0.3s ease',
                        aspectRatio: '1',
                        transform: hoveredImage === image.fileName ? 'scale(1.05)' : 'scale(1)',
                        boxShadow:
                          hoveredImage === image.fileName ? '0 8px 24px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.1)',
                      }}
                      onClick={() => handleBackgroundImageClick(image.fileName)}
                      onMouseEnter={() => setHoveredImage(image.fileName)}
                      onMouseLeave={() => setHoveredImage('')}
                    >
                      {image.base64 ? (
                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                          <Image
                            src={image.base64}
                            alt={image.fileName}
                            width="100%"
                            height="100%"
                            style={{
                              objectFit: 'cover',
                              borderRadius: '8px',
                            }}
                            preview={false}
                          />

                          {/* 썸네일 텍스트 오버레이 */}
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              background: 'rgba(0, 0, 0, 0.3)',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              alignItems: 'center',
                              padding: '12px',
                              borderRadius: '8px',
                            }}
                          >
                            <div
                              style={{
                                color: 'white',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                textAlign: 'center',
                                textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
                                marginBottom: '4px',
                                lineHeight: '1.2',
                              }}
                            >
                              샘플 제목
                            </div>
                            <div
                              style={{
                                color: 'white',
                                fontSize: '10px',
                                textAlign: 'center',
                                textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
                                opacity: 0.9,
                                lineHeight: '1.2',
                              }}
                            >
                              부제목 텍스트
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#f5f5f5',
                            borderRadius: '8px',
                          }}
                        >
                          <PictureOutlined style={{ fontSize: '48px', color: '#bfbfbf' }} />
                        </div>
                      )}

                      {/* 선택 표시 */}
                      {selectedBackgroundImage === image.fileName && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            width: '28px',
                            height: '28px',
                            backgroundColor: '#1890ff',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                          }}
                        >
                          <span style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>✓</span>
                        </div>
                      )}

                      {/* 에디터 이동 표시 */}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '12px',
                          left: '12px',
                          right: '12px',
                          opacity: hoveredImage === image.fileName ? 1 : 0,
                          transition: 'opacity 0.3s ease',
                          background: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          textAlign: 'center',
                        }}
                      >
                        클릭하여 에디터 열기
                      </div>

                      {/* 삭제 버튼 */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '12px',
                          left: '12px',
                          opacity: hoveredImage === image.fileName ? 1 : 0,
                          transition: 'opacity 0.3s ease',
                        }}
                      >
                        <Popconfirm
                          title="정말 삭제하시겠습니까?"
                          onConfirm={e => {
                            e?.stopPropagation()
                            handleDeleteBackgroundImage(image.fileName)
                          }}
                          okText="삭제"
                          cancelText="취소"
                        >
                          <Button
                            type="primary"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={e => e.stopPropagation()}
                            style={{
                              width: '28px',
                              height: '28px',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          />
                        </Popconfirm>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Col>
        </Row>
      </Card>

      {/* 에디터 모달 */}
      <Modal
        title="썸네일 에디터"
        open={editorVisible}
        onCancel={handleEditorClose}
        width="90vw"
        style={{ top: 20 }}
        footer={null}
        destroyOnClose={true}
      >
        {selectedBackgroundImage ? (
          <ThumbnailEditor
            backgroundImage={currentBackgroundBase64}
            onSave={handleLayoutSave}
            onPreview={handleLayoutPreview}
            initialLayout={currentLayout}
          />
        ) : (
          <Alert
            message="배경 이미지를 선택해주세요"
            description="에디터를 사용하려면 먼저 썸네일 템플릿을 선택해주세요."
            type="info"
            showIcon
          />
        )}
      </Modal>

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <Button type="primary" onClick={handleSave} loading={loading} size="large">
          설정 저장
        </Button>
      </div>
    </div>
  )
}
