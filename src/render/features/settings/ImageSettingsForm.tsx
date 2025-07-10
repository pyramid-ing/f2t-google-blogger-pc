import { Button, Form, Input, message, Radio, Card, Divider } from 'antd'
import React, { useEffect, useState } from 'react'
import { useImageSettings } from '@render/hooks/useSettings'
import { testGoogleStorgeConnection } from '@render/api/googleStorageApi'

const { TextArea } = Input

const ImageSettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const { imageSettings, updateImageSettings, isLoading, isSaving } = useImageSettings()
  const [testingGCS, setTestingGCS] = useState(false)

  useEffect(() => {
    form.setFieldsValue({
      imageType: imageSettings.imageType || 'pixabay',
      pixabayApiKey: imageSettings.pixabayApiKey || '',
      gcsBucketName: imageSettings.gcsBucketName || '',
      gcsKeyContent: imageSettings.gcsKeyContent || '',
    })
  }, [imageSettings, form])

  const handleSaveSettings = async (values: any) => {
    try {
      await updateImageSettings({
        imageType: values.imageType,
        pixabayApiKey: values.pixabayApiKey,
        gcsBucketName: values.gcsBucketName,
        gcsKeyContent: values.gcsKeyContent,
      })
    } catch (error) {
      // 에러는 훅에서 처리됨
    }
  }

  const testGCSConnection = async () => {
    try {
      setTestingGCS(true)
      const result = await testGoogleStorgeConnection()

      if (result.status === 'success') {
        message.success('GCS 연결 테스트 성공!')
      } else {
        message.error(`GCS 연결 실패: ${result.error || result.message}`)
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
          <Input type="password" placeholder="Pixabay API 키 입력" disabled={isLoading} />
        </Form.Item>

        <Form.Item name="gcsBucketName" label="GCS Bucket Name" tooltip="Google Cloud Storage 버킷 이름을 입력하세요.">
          <Input placeholder="GCS Bucket Name 입력" disabled={isLoading} />
        </Form.Item>

        <Form.Item name="gcsKeyContent" label="GCS Key Content" tooltip="Google Cloud Storage 키 내용을 입력하세요.">
          <TextArea rows={4} placeholder="GCS Key Content 입력" disabled={isLoading} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={isSaving}>
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
