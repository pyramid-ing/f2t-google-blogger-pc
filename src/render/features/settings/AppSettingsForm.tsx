import React, { useState, useEffect } from 'react'
import { Switch, Input, Button, Form, message } from 'antd'
import { getAppSettingsFromServer, saveAppSettingsToServer } from '../../api'
import { AppSettings } from '../../types/settings'

const { TextArea } = Input

const AppSettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<AppSettings>({})

  // 설정 로드
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await getAppSettingsFromServer()
      setSettings(data)
      form.setFieldsValue(data)
    } catch (error) {
      message.error('설정을 불러오는데 실패했습니다.')
    }
  }

  // 설정 저장
  const handleSave = async (values: AppSettings) => {
    setLoading(true)
    try {
      await saveAppSettingsToServer(values)
      setSettings(values)
      message.success('설정이 저장되었습니다.')
    } catch (error) {
      message.error('설정 저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>일반 설정</h2>

      <Form form={form} layout="vertical" onFinish={handleSave} style={{ maxWidth: 600 }}>
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 'bold' }}>광고 설정</h3>

          <Form.Item name="adEnabled" label="광고 활성화" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item
            name="adScript"
            label="광고 스크립트"
            tooltip="각 섹션에 삽입될 광고 HTML/JavaScript 코드를 입력하세요"
          >
            <TextArea
              rows={8}
              placeholder={`예시:
<div class="ad-container">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>
  <ins class="adsbygoogle"
       style="display:block"
       data-ad-client="ca-pub-xxxxxxxxxx"
       data-ad-slot="xxxxxxxxxx"
       data-ad-format="auto"></ins>
  <script>
       (adsbygoogle = window.adsbygoogle || []).push({});
  </script>
</div>`}
            />
          </Form.Item>
        </div>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            설정 저장
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default AppSettingsForm
