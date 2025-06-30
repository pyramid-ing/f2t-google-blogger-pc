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
} from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import { AppSettings } from '../../types/settings'
import { saveAppSettingsToServer, thumbnailApi } from '../../api'

const { Dragger } = Upload
const { Option } = Select
const { TextArea } = Input

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

  // 폼 초기값 설정
  useEffect(() => {
    form.setFieldsValue({
      thumbnailEnabled: initialSettings.thumbnailEnabled || false,
      thumbnailBackgroundColor: initialSettings.thumbnailBackgroundColor || '#4285f4',
      thumbnailTextColor: initialSettings.thumbnailTextColor || '#ffffff',
      thumbnailFontSize: initialSettings.thumbnailFontSize || 48,
      thumbnailWidth: initialSettings.thumbnailWidth || 1200,
      thumbnailHeight: initialSettings.thumbnailHeight || 630,
      thumbnailFontFamily: initialSettings.thumbnailFontFamily || 'Arial, sans-serif',
      gcsEnabled: initialSettings.gcsEnabled || false,
      gcsProjectId: initialSettings.gcsProjectId || '',
      gcsKeyContent: initialSettings.gcsKeyContent || '',
      gcsBucketName: initialSettings.gcsBucketName || '',
    })
  }, [initialSettings, form])

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
      }

      // 임시로 설정 저장 (UI 반영용)
      await saveAppSettingsToServer(tempSettings)

      const result = await thumbnailApi.previewThumbnail({
        title: '썸네일 미리보기',
        subtitle: '설정된 스타일로 생성됩니다',
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

      <Card title="Google Cloud Storage 설정" style={{ marginBottom: 16 }}>
        <Alert
          message="GCS 설정 안내"
          description="썸네일 이미지를 Google Cloud Storage에 업로드하려면 GCS 프로젝트와 서비스 계정 키가 필요합니다."
          type="info"
          style={{ marginBottom: 16 }}
        />

        <Form form={form} layout="vertical">
          <Form.Item name="gcsEnabled" label="GCS 업로드 활성화" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="gcsProjectId" label="GCS 프로젝트 ID" dependencies={['gcsEnabled']}>
            <Input placeholder="your-gcs-project-id" />
          </Form.Item>

          <Form.Item
            name="gcsKeyContent"
            label="서비스 계정 키 JSON"
            dependencies={['gcsEnabled']}
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

          <Form.Item name="gcsBucketName" label="GCS 버킷명" dependencies={['gcsEnabled']}>
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
