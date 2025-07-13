import React, { useEffect } from 'react'
import { Button, Form, Input, Radio, Divider } from 'antd'
import { useAISettings } from '@render/hooks/useSettings'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'

type ValidationResult = {
  isValid: boolean
  message: string
}

type ValidationResults = {
  openai: ValidationResult | null
  gemini: ValidationResult | null
}

export const AISettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const { aiSettings, updateAISettings, isLoading, isSaving } = useAISettings()
  const [validating, setValidating] = React.useState<{ [key: string]: boolean }>({
    openai: false,
    gemini: false,
  })
  const [validationResults, setValidationResults] = React.useState<ValidationResults>({
    openai: null,
    gemini: null,
  })

  // aiSettings가 변경될 때마다 폼 값을 업데이트
  useEffect(() => {
    if (aiSettings) {
      form.setFieldsValue({
        aiProvider: aiSettings.aiProvider || 'gemini',
        openaiApiKey: aiSettings.openaiApiKey || '',
        geminiApiKey: aiSettings.geminiApiKey || '',
      })
    }
  }, [aiSettings, form])

  const handleSaveSettings = async (values: any) => {
    try {
      await updateAISettings({
        aiProvider: values.aiProvider,
        openaiApiKey: values.openaiApiKey || '',
        geminiApiKey: values.geminiApiKey || '',
      })
    } catch (error) {
      console.error('Error saving settings:', error)
    }
  }

  const ValidationStatus: React.FC<{ result: ValidationResult | null }> = ({ result }) => {
    if (!result) return null

    return (
      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {result.isValid ? (
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
        ) : (
          <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
        )}
        <span style={{ color: result.isValid ? '#52c41a' : '#ff4d4f' }}>{result.message}</span>
      </div>
    )
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
            <Radio value="openai">챗GPT</Radio>
            <Radio value="gemini">구글 제미나이</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) => prevValues.aiProvider !== currentValues.aiProvider}
        >
          {({ getFieldValue }) => {
            const provider = getFieldValue('aiProvider')
            return (
              <>
                {provider === 'openai' && (
                  <Form.Item
                    name="openaiApiKey"
                    label="챗GPT API키"
                    rules={[
                      {
                        required: provider === 'openai',
                        message: '챗GPT API키를 입력해주세요',
                      },
                    ]}
                  >
                    <Input.Password placeholder="챗GPT API키를 입력하세요" />
                  </Form.Item>
                )}

                {provider === 'gemini' && (
                  <Form.Item
                    name="geminiApiKey"
                    label="제미나이 API키"
                    rules={[
                      {
                        required: provider === 'gemini',
                        message: '제미나이 API키를 입력해주세요',
                      },
                    ]}
                  >
                    <Input.Password placeholder="제미나이 API키를 입력하세요" />
                  </Form.Item>
                )}
              </>
            )
          }}
        </Form.Item>

        <Divider />

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={isSaving}>
            설정 저장
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default AISettingsForm
