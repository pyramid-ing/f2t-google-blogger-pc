import React, { useEffect, useState } from 'react'
import { getSettings, updateSettings, validateAIKey } from '@render/api/settingsApi'
import { Button, Form, Input, Radio, message, Divider } from 'antd'

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
        perplexityApiKey: settings.perplexityApiKey,
        aiProvider: settings.aiProvider,
        openaiApiKey: settings.openaiApiKey,
        geminiApiKey: settings.geminiApiKey,
      })
    } catch (error) {
      message.error('설정을 불러오는데 실패했습니다.')
    }
  }

  const handleSaveSettings = async (values: any) => {
    setLoading(true)
    try {
      const settings = await getSettings()

      await updateSettings({
        ...settings,
        perplexityApiKey: values.perplexityApiKey,
        aiProvider: values.aiProvider,
        openaiApiKey: values.openaiApiKey,
        geminiApiKey: values.geminiApiKey,
      })
      message.success('AI 설정이 저장되었습니다.')
    } catch (error) {
      console.error('Error saving settings:', error)
      message.error('구글 설정 저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const validateKey = async (provider: 'openai' | 'gemini' | 'perplexity', key: string) => {
    try {
      setValidating(true)
      const result = await validateAIKey({ provider, apiKey: key })
      if (result.valid) {
        message.success(`${provider.toUpperCase()} API 키가 유효합니다.`)
      } else {
        message.error(`${provider.toUpperCase()} API 키가 유효하지 않습니다: ${result.error}`)
      }
    } catch (error) {
      message.error('API 키 검증에 실패했습니다.')
    } finally {
      setValidating(false)
    }
  }

  return (
    <Form form={form} onFinish={handleSaveSettings} layout="vertical">
      <Form.Item name="aiProvider" label="AI 제공자" rules={[{ required: true, message: 'AI 제공자를 선택해주세요.' }]}>
        <Radio.Group>
          <Radio.Button value="openai">OpenAI</Radio.Button>
          <Radio.Button value="gemini">Gemini</Radio.Button>
        </Radio.Group>
      </Form.Item>

      <Form.Item
        name="perplexityApiKey"
        label="Perplexity API 키"
        rules={[{ required: true, message: 'Perplexity API 키를 입력해주세요.' }]}
        extra={
          <Button
            type="link"
            onClick={() => {
              const key = form.getFieldValue('perplexityApiKey')
              if (key) validateKey('perplexity', key)
            }}
            loading={validating}
          >
            API 키 검증
          </Button>
        }
      >
        <Input.Password placeholder="pplx-..." />
      </Form.Item>

      <Divider>선택적 AI 설정</Divider>

      <Form.Item
        name="openaiApiKey"
        label="OpenAI API 키"
        extra={
          <Button
            type="link"
            onClick={() => {
              const key = form.getFieldValue('openaiApiKey')
              if (key) validateKey('openai', key)
            }}
            loading={validating}
          >
            API 키 검증
          </Button>
        }
      >
        <Input.Password placeholder="sk-..." />
      </Form.Item>

      <Form.Item
        name="geminiApiKey"
        label="Gemini API 키"
        extra={
          <Button
            type="link"
            onClick={() => {
              const key = form.getFieldValue('geminiApiKey')
              if (key) validateKey('gemini', key)
            }}
            loading={validating}
          >
            API 키 검증
          </Button>
        }
      >
        <Input.Password />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          저장
        </Button>
      </Form.Item>
    </Form>
  )
}
