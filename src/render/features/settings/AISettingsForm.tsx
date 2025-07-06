import React, { useState, useEffect } from 'react'
import { Form, Input, Button, Radio, message } from 'antd'
import { getSettings, updateSettings, validateAIKey } from '@render/api/settingsApi'
import { AISettings } from '@render/types/settings'

export const AISettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const settings = await getSettings()
      form.setFieldsValue({
        openaiApiKey: settings.openaiApiKey,
        geminiApiKey: settings.geminiApiKey,
        aiProvider: settings.aiProvider || 'openai',
      })
    } catch (error) {
      console.error('설정 로드 실패:', error)
      message.error('설정을 불러오는데 실패했습니다.')
    }
  }

  const handleSubmit = async (values: AISettings) => {
    setLoading(true)
    try {
      await updateSettings(values)
      message.success('설정이 저장되었습니다.')
    } catch (error) {
      console.error('설정 저장 실패:', error)
      message.error('설정 저장에 실패했습니다.')
    }
    setLoading(false)
  }

  const validateKey = async () => {
    setValidating(true)
    try {
      const values = form.getFieldsValue()
      const provider = values.aiProvider
      const key = provider === 'openai' ? values.openaiApiKey : values.geminiApiKey

      if (!key) {
        message.error('API 키를 입력해주세요.')
        return
      }

      const result = await validateAIKey({ provider, apiKey: key })
      if (result.valid) {
        message.success('API 키가 유효합니다.')
      } else {
        message.error('API 키가 유효하지 않습니다.')
      }
    } catch (error) {
      console.error('API 키 검증 실패:', error)
      message.error('API 키 검증에 실패했습니다.')
    }
    setValidating(false)
  }

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ maxWidth: 600 }}>
      <Form.Item
        name="aiProvider"
        label="AI 서비스 제공자"
        rules={[{ required: true, message: 'AI 서비스 제공자를 선택해주세요.' }]}
      >
        <Radio.Group>
          <Radio.Button value="openai">OpenAI</Radio.Button>
          <Radio.Button value="gemini">Google Gemini</Radio.Button>
        </Radio.Group>
      </Form.Item>

      <Form.Item noStyle shouldUpdate={(prev, curr) => prev.aiProvider !== curr.aiProvider}>
        {({ getFieldValue }) => {
          const provider = getFieldValue('aiProvider')
          return provider === 'openai' ? (
            <Form.Item
              name="openaiApiKey"
              label="OpenAI API 키"
              rules={[{ required: true, message: 'OpenAI API 키를 입력해주세요.' }]}
            >
              <Input.Password placeholder="sk-..." />
            </Form.Item>
          ) : (
            <Form.Item
              name="geminiApiKey"
              label="Google Gemini API 키"
              rules={[{ required: true, message: 'Gemini API 키를 입력해주세요.' }]}
            >
              <Input.Password placeholder="AI..." />
            </Form.Item>
          )
        }}
      </Form.Item>

      <Form.Item>
        <Button type="primary" onClick={validateKey} loading={validating} style={{ marginRight: 8 }}>
          API 키 검증
        </Button>
        <Button type="primary" htmlType="submit" loading={loading}>
          저장
        </Button>
      </Form.Item>
    </Form>
  )
}
