import { Button, Form, Input, message, Radio } from 'antd'
import React, { useEffect, useState } from 'react'
import { getAppSettingsFromServer, saveAppSettingsToServer } from '../../api'

const ImageSettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true)
      try {
        const settings = await getAppSettingsFromServer()
        form.setFieldsValue({
          imageType: settings.imageType || 'pixabay',
          pixabayApiKey: settings.pixabayApiKey || '',
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
      const currentSettings = await getAppSettingsFromServer()

      await saveAppSettingsToServer({
        ...currentSettings,
        imageType: values.imageType,
        pixabayApiKey: values.pixabayApiKey,
      })
      message.success('이미지 설정이 저장되었습니다.')
    } catch (error) {
      console.error('Error saving settings:', error)
      message.error('이미지 설정 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
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

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>
            저장
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default ImageSettingsForm
