import React, { useState, useEffect } from 'react'
import {
  Card,
  Form,
  Input,
  Switch,
  Button,
  ColorPicker,
  InputNumber,
  Select,
  message,
  Upload,
  Row,
  Col,
  Image,
  Space,
  Alert,
  Popconfirm,
  Typography,
} from 'antd'
import { EyeOutlined, UploadOutlined, DeleteOutlined, PictureOutlined } from '@ant-design/icons'
import { AppSettings } from '../../types/settings'
import { saveAppSettingsToServer, thumbnailApi, BackgroundImageInfo } from '../../api'

const { Dragger } = Upload
const { Option } = Select
const { TextArea } = Input
const { Text } = Typography

interface ThumbnailSettingsFormProps {
  initialSettings?: AppSettings
  onSave: (settings: Partial<AppSettings>) => Promise<void>
}

export const ThumbnailSettingsForm: React.FC<ThumbnailSettingsFormProps> = ({ initialSettings = {}, onSave }) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [testingGCS, setTestingGCS] = useState(false)
  const [previewImage, setPreviewImage] = useState<string>('')
  const [generatingPreview, setGeneratingPreview] = useState(false)
  const [backgroundImages, setBackgroundImages] = useState<BackgroundImageInfo[]>([])
  const [uploadingBackground, setUploadingBackground] = useState(false)
  const [selectedBackgroundImage, setSelectedBackgroundImage] = useState<string>('')
  const [hoveredImage, setHoveredImage] = useState<string>('')

  // 폼 초기값 설정
  useEffect(() => {
    form.setFieldsValue({
      thumbnailEnabled: initialSettings.thumbnailEnabled || false,
      thumbnailBackgroundColor: initialSettings.thumbnailBackgroundColor || '#4285f4',
      thumbnailBackgroundImage: initialSettings.thumbnailBackgroundImage || '',
      thumbnailTextColor: initialSettings.thumbnailTextColor || '#ffffff',
      thumbnailFontSize: initialSettings.thumbnailFontSize || 48,
      thumbnailWidth: initialSettings.thumbnailWidth || 1200,
      thumbnailHeight: initialSettings.thumbnailHeight || 630,
      thumbnailFontFamily: initialSettings.thumbnailFontFamily || 'Arial, sans-serif',
      gcsProjectId: initialSettings.gcsProjectId || '',
      gcsKeyContent: initialSettings.gcsKeyContent || '',
      gcsBucketName: initialSettings.gcsBucketName || '',
    })

    setSelectedBackgroundImage(initialSettings.thumbnailBackgroundImage || '')
  }, [initialSettings, form])

  // 배경이미지 목록 로드
  useEffect(() => {
    loadBackgroundImages()
  }, [])

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

      // 색상 값이 객체인 경우 hex 값으로 변환
      const settings: Partial<AppSettings> = {
        ...values,
        thumbnailBackgroundColor:
          typeof values.thumbnailBackgroundColor === 'object'
            ? values.thumbnailBackgroundColor.toHexString()
            : values.thumbnailBackgroundColor,
        thumbnailTextColor:
          typeof values.thumbnailTextColor === 'object'
            ? values.thumbnailTextColor.toHexString()
            : values.thumbnailTextColor,
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

  const testGCSConnection = async () => {
    try {
      setTestingGCS(true)
      const result = await thumbnailApi.testGCSConnection()

      if (result.success) {
        message.success('GCS 연결 테스트 성공!')
      } else {
        message.error(`GCS 연결 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('GCS 연결 테스트 실패:', error)
      message.error('GCS 연결 테스트 중 오류가 발생했습니다.')
    } finally {
      setTestingGCS(false)
    }
  }

  const generatePreview = async () => {
    try {
      setGeneratingPreview(true)

      const values = await form.validateFields([
        'thumbnailBackgroundColor',
        'thumbnailTextColor',
        'thumbnailFontSize',
        'thumbnailWidth',
        'thumbnailHeight',
        'thumbnailFontFamily',
      ])

      // 현재 폼 값으로 설정 임시 업데이트
      const tempSettings = {
        ...values,
        thumbnailBackgroundColor:
          typeof values.thumbnailBackgroundColor === 'object'
            ? values.thumbnailBackgroundColor.toHexString()
            : values.thumbnailBackgroundColor,
        thumbnailTextColor:
          typeof values.thumbnailTextColor === 'object'
            ? values.thumbnailTextColor.toHexString()
            : values.thumbnailTextColor,
        thumbnailBackgroundImage: selectedBackgroundImage,
      }

      // 임시로 설정 저장 (UI 반영용)
      await saveAppSettingsToServer(tempSettings)

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

  const fontFamilyOptions = [
    'Arial, sans-serif',
    'Helvetica, sans-serif',
    'Georgia, serif',
    'Times New Roman, serif',
    'Verdana, sans-serif',
    'Trebuchet MS, sans-serif',
    'Impact, sans-serif',
    'Comic Sans MS, cursive',
    'Courier New, monospace',
  ]

  return (
    <div>
      <Card title="썸네일 설정" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="thumbnailEnabled" label="썸네일 생성 활성화" valuePropName="checked">
                <Switch />
              </Form.Item>

              <Form.Item name="thumbnailBackgroundColor" label="배경 색상" dependencies={['thumbnailEnabled']}>
                <ColorPicker showText />
              </Form.Item>

              <Form.Item name="thumbnailTextColor" label="텍스트 색상" dependencies={['thumbnailEnabled']}>
                <ColorPicker showText />
              </Form.Item>

              <Form.Item name="thumbnailFontSize" label="폰트 크기" dependencies={['thumbnailEnabled']}>
                <InputNumber min={20} max={100} addonAfter="px" />
              </Form.Item>

              <Form.Item name="thumbnailFontFamily" label="폰트 패밀리" dependencies={['thumbnailEnabled']}>
                <Select>
                  {fontFamilyOptions.map(font => (
                    <Option key={font} value={font}>
                      {font}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="thumbnailWidth" label="이미지 너비" dependencies={['thumbnailEnabled']}>
                    <InputNumber min={600} max={2000} addonAfter="px" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="thumbnailHeight" label="이미지 높이" dependencies={['thumbnailEnabled']}>
                    <InputNumber min={300} max={1000} addonAfter="px" />
                  </Form.Item>
                </Col>
              </Row>
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

      <Card title="배경이미지 설정" style={{ marginBottom: 16 }}>
        <Alert
          message="배경이미지 설정"
          description="썸네일에 사용할 배경이미지를 업로드하고 관리할 수 있습니다. 이미지가 없으면 배경색이 사용됩니다."
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
                style={{ marginBottom: 16, width: '100%' }}
              >
                배경이미지 업로드
              </Button>
            </Upload>

            {backgroundImages.length > 0 && (
              <div>
                <Text strong style={{ marginBottom: 16, display: 'block' }}>
                  배경이미지 선택
                </Text>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                    gap: '12px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    padding: '8px',
                    border: '1px solid #f0f0f0',
                    borderRadius: '6px',
                    backgroundColor: '#fafafa',
                  }}
                >
                  {backgroundImages.map(image => (
                    <div
                      key={image.fileName}
                      style={{
                        position: 'relative',
                        cursor: 'pointer',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border:
                          selectedBackgroundImage === image.fileName ? '3px solid #1890ff' : '3px solid transparent',
                        transition: 'all 0.2s ease',
                        aspectRatio: '1',
                        transform:
                          hoveredImage === image.fileName && selectedBackgroundImage !== image.fileName
                            ? 'scale(1.05)'
                            : 'scale(1)',
                      }}
                      onClick={() => {
                        setSelectedBackgroundImage(image.fileName)
                        form.setFieldValue('thumbnailBackgroundImage', image.fileName)
                      }}
                      onMouseEnter={() => setHoveredImage(image.fileName)}
                      onMouseLeave={() => setHoveredImage('')}
                    >
                      {image.base64 ? (
                        <Image
                          src={image.base64}
                          alt={image.fileName}
                          width="100%"
                          height="100%"
                          style={{
                            objectFit: 'cover',
                            borderRadius: '6px',
                          }}
                          preview={false}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#f5f5f5',
                            borderRadius: '6px',
                          }}
                        >
                          <PictureOutlined style={{ fontSize: '32px', color: '#bfbfbf' }} />
                        </div>
                      )}

                      {/* 선택 표시 */}
                      {selectedBackgroundImage === image.fileName && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            width: '24px',
                            height: '24px',
                            backgroundColor: '#1890ff',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <span style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>✓</span>
                        </div>
                      )}

                      {/* 삭제 버튼 */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          opacity: hoveredImage === image.fileName ? 1 : 0,
                          transition: 'opacity 0.2s ease',
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
                              width: '24px',
                              height: '24px',
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

            {selectedBackgroundImage && (
              <div style={{ marginTop: 16 }}>
                <Button
                  type="dashed"
                  onClick={() => {
                    setSelectedBackgroundImage('')
                    form.setFieldValue('thumbnailBackgroundImage', '')
                  }}
                  style={{ width: '100%' }}
                >
                  배경이미지 선택 해제
                </Button>
              </div>
            )}
          </Col>

          <Col span={12}>
            {selectedBackgroundImage && (
              <div>
                <Text strong style={{ marginBottom: 16, display: 'block' }}>
                  선택된 배경이미지
                </Text>
                <div
                  style={{
                    border: '2px solid #1890ff',
                    borderRadius: '8px',
                    padding: '8px',
                    textAlign: 'center',
                    backgroundColor: '#fafafa',
                  }}
                >
                  {(() => {
                    const selectedImage = backgroundImages.find(img => img.fileName === selectedBackgroundImage)
                    return selectedImage?.base64 ? (
                      <Image
                        src={selectedImage.base64}
                        alt={selectedBackgroundImage}
                        style={{
                          width: '100%',
                          maxHeight: '300px',
                          objectFit: 'contain',
                          borderRadius: '6px',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          height: '200px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#f5f5f5',
                          borderRadius: '6px',
                        }}
                      >
                        <PictureOutlined style={{ fontSize: '64px', color: '#bfbfbf' }} />
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}
          </Col>
        </Row>
      </Card>

      <Card title="Google Cloud Storage 설정" style={{ marginBottom: 16 }}>
        <Alert
          message="GCS 설정 안내"
          description="썸네일 이미지가 항상 Google Cloud Storage에 업로드됩니다. GCS 프로젝트와 서비스 계정 키를 설정해주세요."
          type="info"
          style={{ marginBottom: 16 }}
        />

        <Form form={form} layout="vertical">
          <Form.Item name="gcsProjectId" label="GCS 프로젝트 ID">
            <Input placeholder="your-gcs-project-id" />
          </Form.Item>

          <Form.Item
            name="gcsKeyContent"
            label="서비스 계정 키 JSON"
            tooltip="Google Cloud Console에서 다운로드한 서비스 계정 키 JSON 파일의 전체 내용을 복사해서 붙여넣으세요"
          >
            <TextArea
              rows={8}
              placeholder={`{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n",
  "client_email": "service-account@your-project.iam.gserviceaccount.com",
  "client_id": "client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/service-account%40your-project.iam.gserviceaccount.com"
}`}
              style={{ fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace', fontSize: '12px' }}
            />
          </Form.Item>

          <Form.Item name="gcsBucketName" label="GCS 버킷명">
            <Input placeholder="your-bucket-name" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button onClick={testGCSConnection} loading={testingGCS}>
                연결 테스트
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <Button type="primary" size="large" onClick={handleSave} loading={loading}>
          설정 저장
        </Button>
      </div>
    </div>
  )
}
