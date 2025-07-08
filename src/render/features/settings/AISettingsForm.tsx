import React, { useEffect } from 'react'
import { validateAIKey } from '@render/api/settingsApi'
import { Button, Form, Input, Radio, message, Divider } from 'antd'
import { useAISettings } from '@render/hooks/useSettings'

export const AISettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const { aiSettings, updateAISettings, isLoading, isSaving } = useAISettings()
  const [validating, setValidating] = React.useState(false)

  useEffect(() => {
    form.setFieldsValue(aiSettings)
  }, [aiSettings, form])

  const handleSaveSettings = async (values: any) => {
    try {
      await updateAISettings({
        perplexityApiKey: values.perplexityApiKey,
        aiProvider: values.aiProvider,
        openaiApiKey: values.openaiApiKey,
        geminiApiKey: values.geminiApiKey,
      })
    } catch (error) {
      // 에러는 훅에서 처리됨
    }
  }

  const handleValidateKey = async () => {
    setValidating(true)
    try {
      const values = form.getFieldsValue()
      const result = await validateAIKey({
        provider: values.aiProvider,
        apiKey: values.aiProvider === 'openai' ? values.openaiApiKey : values.geminiApiKey,
      })

      if (result.valid) {
        message.success('API 키가 유효합니다.')
      } else {
        message.error(`API 키가 유효하지 않습니다: ${result.error}`)
      }
    } catch (error) {
      message.error('API 키 검증 중 오류가 발생했습니다.')
    } finally {
      setValidating(false)
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>AI 설정</h2>
      <Form form={form} layout="vertical" onFinish={handleSaveSettings}>
        <Form.Item
          name="aiProvider"
          label="AI 제공자"
          rules={[{ required: true, message: 'AI 제공자를 선택해주세요' }]}
        >
          <Radio.Group>
            <Radio value="openai">OpenAI</Radio>
            <Radio value="gemini">Google Gemini</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          name="openaiApiKey"
          label="OpenAI API Key"
          rules={[
            {
              required: aiSettings.aiProvider === 'openai',
              message: 'OpenAI API Key를 입력해주세요',
            },
          ]}
        >
          <Input.Password placeholder="OpenAI API Key를 입력하세요" />
        </Form.Item>

        <Form.Item
          name="geminiApiKey"
          label="Gemini API Key"
          rules={[
            {
              required: aiSettings.aiProvider === 'gemini',
              message: 'Gemini API Key를 입력해주세요',
            },
          ]}
        >
          <Input.Password placeholder="Gemini API Key를 입력하세요" />
        </Form.Item>

        <Divider />

        <Form.Item name="perplexityApiKey" label="Perplexity API Key (선택사항)">
          <Input.Password placeholder="Perplexity API Key를 입력하세요" />
        </Form.Item>

        <Form.Item>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button type="primary" htmlType="submit" loading={isSaving}>
              설정 저장
            </Button>
            <Button onClick={handleValidateKey} loading={validating}>
              API 키 검증
            </Button>
          </div>
        </Form.Item>
      </Form>
    </div>
  )
}

export default AISettingsForm
