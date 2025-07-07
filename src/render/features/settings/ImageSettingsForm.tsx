import { Button, Form, Input, message, Radio, Card, Divider } from 'antd'
import React, { useEffect, useState } from 'react'
import { getSettings, updateSettings } from '../../api'
import { testGoogleStorgeConnection } from '@render/api/googleStorageApi'

const { TextArea } = Input

const ImageSettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testingGCS, setTestingGCS] = useState(false)

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true)
      try {
        const settings = await getSettings()
        form.setFieldsValue({
          imageType: settings.imageType || 'pixabay',
          pixabayApiKey: settings.pixabayApiKey || '',
          gcsProjectId: settings.gcsProjectId || '',
          gcsBucketName: settings.gcsBucketName || '',
          gcsKeyContent: settings.gcsKeyContent || '',
        })
      } catch (error) {
        console.error('Error loading settings:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  const handleSaveSettings = async (values: any) => {
    setSaving(true)
    try {
      const currentSettings = await getSettings()

      await updateSettings({
        ...currentSettings,
        imageType: values.imageType,
        pixabayApiKey: values.pixabayApiKey,
        gcsProjectId: values.gcsProjectId,
        gcsBucketName: values.gcsBucketName,
        gcsKeyContent: values.gcsKeyContent,
      })
      message.success('이미지 설정이 저장되었습니다.')
    } catch (error) {
      console.error('Error saving settings:', error)
      message.error('이미지 설정 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const testGCSConnection = async () => {
    try {
      setTestingGCS(true)
      const result = await testGoogleStorgeConnection()

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

  return (
    <div style={{ padding: '20px' }}>
      <h2>이미지 설정</h2>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSaveSettings}
        initialValues={{
          imageType: 'pixabay',
          pixabayApiKey: '',
          gcsProjectId: '',
          gcsBucketName: '',
          gcsKeyContent: '',
        }}
      >
        <Form.Item
          name="imageType"
          label="이미지 생성 방식"
          tooltip="포스트에 삽입할 이미지를 생성하는 방식을 선택하세요."
        >
          <Radio.Group>
            <Radio value="ai">AI 생성</Radio>
            <Radio value="pixabay">Pixabay 검색</Radio>
            <Radio value="none">사용안함</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          name="pixabayApiKey"
          label="Pixabay API Key"
          tooltip="Pixabay에서 이미지를 검색하기 위한 API 키를 입력하세요."
        >
          <Input type="password" placeholder="Pixabay API 키 입력" disabled={loading} />
        </Form.Item>

        <Form.Item name="gcsProjectId" label="GCS Project ID" tooltip="Google Cloud Storage 프로젝트 ID를 입력하세요.">
          <Input placeholder="GCS Project ID 입력" disabled={loading} />
        </Form.Item>

        <Form.Item name="gcsBucketName" label="GCS Bucket Name" tooltip="Google Cloud Storage 버킷 이름을 입력하세요.">
          <Input placeholder="GCS Bucket Name 입력" disabled={loading} />
        </Form.Item>

        <Form.Item name="gcsKeyContent" label="GCS Key Content" tooltip="Google Cloud Storage 키 내용을 입력하세요.">
          <TextArea rows={4} placeholder="GCS Key Content 입력" disabled={loading} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>
            저장
          </Button>
        </Form.Item>
      </Form>

      <Divider />

      <Card title="GCS 연결 테스트">
        <Button type="primary" onClick={testGCSConnection} loading={testingGCS}>
          연결 테스트
        </Button>
      </Card>
    </div>
  )
}

export default ImageSettingsForm
