import { Button, Form, Input, message, Alert, Space } from 'antd'
import { CheckCircleOutlined, LoadingOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import React, { useEffect, useState, useCallback } from 'react'
import {
  getAppSettingsFromServer,
  saveAppSettingsToServer,
  validateOpenAIApiKey,
  validatePerplexityApiKey,
} from '../../api'

interface ValidationState {
  status: 'idle' | 'validating' | 'valid' | 'invalid'
  message?: string
  model?: string
}

const AISettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const [openaiValidation, setOpenaiValidation] = useState<ValidationState>({ status: 'idle' })
  const [perplexityValidation, setPerplexityValidation] = useState<ValidationState>({ status: 'idle' })
  const [isValidating, setIsValidating] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)
  const [perplexityDebounceTimer, setPerplexityDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    ;(async () => {
      const settings = await getAppSettingsFromServer()
      const openaiKey = settings.openaiApiKey || ''
      const perplexityKey = settings.perplexityApiKey || ''
      form.setFieldsValue({
        openAIApiKey: openaiKey,
        perplexityApiKey: perplexityKey,
      })

      // 기존 키가 있으면 자동 검증
      if (openaiKey) {
        await handleValidateOpenAIKey(openaiKey)
      }
      if (perplexityKey) {
        await handleValidatePerplexityKey(perplexityKey)
      }
    })()
  }, [form])

  const handleValidateOpenAIKey = async (apiKey: string) => {
    if (!apiKey || apiKey.trim().length === 0) {
      setOpenaiValidation({ status: 'idle' })
      return
    }

    setIsValidating(true)
    setOpenaiValidation({ status: 'validating' })

    try {
      const result = await validateOpenAIApiKey(apiKey.trim())

      if (result.valid) {
        setOpenaiValidation({
          status: 'valid',
          message: `유효한 API 키입니다.`,
          model: result.model,
        })
      } else {
        setOpenaiValidation({
          status: 'invalid',
          message: result.error || '알 수 없는 오류가 발생했습니다.',
        })
      }
    } catch (error) {
      setOpenaiValidation({
        status: 'invalid',
        message: '검증 중 오류가 발생했습니다.',
      })
    } finally {
      setIsValidating(false)
    }
  }

  const handleValidatePerplexityKey = async (apiKey: string) => {
    if (!apiKey || apiKey.trim().length === 0) {
      setPerplexityValidation({ status: 'idle' })
      return
    }

    setIsValidating(true)
    setPerplexityValidation({ status: 'validating' })

    try {
      const result = await validatePerplexityApiKey(apiKey.trim())

      if (result.valid) {
        setPerplexityValidation({
          status: 'valid',
          message: `유효한 API 키입니다.`,
          model: result.model,
        })
      } else {
        setPerplexityValidation({
          status: 'invalid',
          message: result.error || '알 수 없는 오류가 발생했습니다.',
        })
      }
    } catch (error) {
      setPerplexityValidation({
        status: 'invalid',
        message: '검증 중 오류가 발생했습니다.',
      })
    } finally {
      setIsValidating(false)
    }
  }

  const debouncedValidateOpenAI = useCallback(
    (apiKey: string) => {
      // 기존 타이머 클리어
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      // 새 타이머 설정 (1초 후 검증)
      const timer = setTimeout(() => {
        handleValidateOpenAIKey(apiKey)
      }, 1000)

      setDebounceTimer(timer)
    },
    [debounceTimer],
  )

  const debouncedValidatePerplexity = useCallback(
    (apiKey: string) => {
      // 기존 타이머 클리어
      if (perplexityDebounceTimer) {
        clearTimeout(perplexityDebounceTimer)
      }

      // 새 타이머 설정 (1초 후 검증)
      const timer = setTimeout(() => {
        handleValidatePerplexityKey(apiKey)
      }, 1000)

      setPerplexityDebounceTimer(timer)
    },
    [perplexityDebounceTimer],
  )

  const onFinish = async (values: { openAIApiKey: string; perplexityApiKey: string }) => {
    try {
      // 저장 전에 한 번 더 검증
      if (values.openAIApiKey && openaiValidation.status !== 'valid') {
        message.warning('유효한 OpenAI API 키를 입력한 후 저장해주세요.')
        return
      }

      // 현재 설정을 가져와서 API 키들 업데이트
      const currentSettings = await getAppSettingsFromServer()
      await saveAppSettingsToServer({
        ...currentSettings,
        openaiApiKey: values.openAIApiKey,
        perplexityApiKey: values.perplexityApiKey,
      })
      message.success('AI API 키들이 저장되었습니다.')
    } catch {
      message.error('저장에 실패했습니다.')
    }
  }

  const onOpenAIApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    // 입력이 변경되면 검증 상태 초기화
    setOpenaiValidation({ status: 'idle' })

    // debounce로 자동 검증
    if (value.trim().length > 0) {
      debouncedValidateOpenAI(value)
    }
  }

  const onPerplexityApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    // 입력이 변경되면 검증 상태 초기화
    setPerplexityValidation({ status: 'idle' })

    // debounce로 자동 검증
    if (value.trim().length > 0) {
      debouncedValidatePerplexity(value)
    }
  }

  const renderOpenAIValidationStatus = () => {
    switch (openaiValidation.status) {
      case 'validating':
        return (
          <Alert
            message={
              <Space>
                <LoadingOutlined />
                OpenAI API 키 검증 중...
              </Space>
            }
            type="info"
            showIcon={false}
            style={{ marginTop: 8 }}
          />
        )
      case 'valid':
        return (
          <Alert
            message={
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                {openaiValidation.message}
                {openaiValidation.model && <span style={{ color: '#666' }}>({openaiValidation.model})</span>}
              </Space>
            }
            type="success"
            showIcon={false}
            style={{ marginTop: 8 }}
          />
        )
      case 'invalid':
        return (
          <Alert
            message={
              <Space>
                <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                {openaiValidation.message}
              </Space>
            }
            type="error"
            showIcon={false}
            style={{ marginTop: 8 }}
          />
        )
      default:
        return null
    }
  }

  const renderPerplexityValidationStatus = () => {
    switch (perplexityValidation.status) {
      case 'validating':
        return (
          <Alert
            message={
              <Space>
                <LoadingOutlined />
                Perplexity API 키 검증 중...
              </Space>
            }
            type="info"
            showIcon={false}
            style={{ marginTop: 8 }}
          />
        )
      case 'valid':
        return (
          <Alert
            message={
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                {perplexityValidation.message}
                {perplexityValidation.model && <span style={{ color: '#666' }}>({perplexityValidation.model})</span>}
              </Space>
            }
            type="success"
            showIcon={false}
            style={{ marginTop: 8 }}
          />
        )
      case 'invalid':
        return (
          <Alert
            message={
              <Space>
                <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                {perplexityValidation.message}
              </Space>
            }
            type="error"
            showIcon={false}
            style={{ marginTop: 8 }}
          />
        )
      default:
        return null
    }
  }

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      if (perplexityDebounceTimer) {
        clearTimeout(perplexityDebounceTimer)
      }
    }
  }, [debounceTimer, perplexityDebounceTimer])

  return (
    <div>
      <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 600 }}>AI</h3>
      <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxWidth: 500 }}>
        <Form.Item
          label="OpenAI API 키"
          name="openAIApiKey"
          rules={[{ required: true, message: 'API 키를 입력하세요.' }]}
          extra="ChatGPT API를 사용하기 위한 OpenAI API 키를 입력하세요. 입력 후 자동으로 검증됩니다."
        >
          <Input.Password placeholder="sk-..." autoComplete="off" onChange={onOpenAIApiKeyChange} />
        </Form.Item>

        {renderOpenAIValidationStatus()}

        <Form.Item
          label="Perplexity API 키"
          name="perplexityApiKey"
          extra="포스팅에 관련 링크를 추가하기 위한 Perplexity API 키를 입력하세요. 입력 후 자동으로 검증됩니다. (선택사항)"
        >
          <Input.Password placeholder="pplx-..." autoComplete="off" onChange={onPerplexityApiKeyChange} />
        </Form.Item>

        {renderPerplexityValidationStatus()}

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={isValidating} style={{ marginTop: 16 }}>
            저장
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default AISettingsForm
