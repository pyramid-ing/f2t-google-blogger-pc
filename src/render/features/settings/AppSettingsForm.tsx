import { Button, Form, Input, message, Space, Avatar } from 'antd'
import React, { useEffect, useState } from 'react'
import {
  getAppSettingsFromServer,
  saveAppSettingsToServer,
  startGoogleLogin,
  getGoogleUserInfo,
  isGoogleLoggedIn,
} from '../../api'
import { UserOutlined } from '@ant-design/icons'

const AppSettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [userInfo, setUserInfo] = useState<any>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true)
      try {
        const settings = await getAppSettingsFromServer()
        setClientId(settings.oauth2ClientId || '')
        setClientSecret(settings.oauth2ClientSecret || '')
        form.setFieldsValue(settings)

        const loggedIn = await isGoogleLoggedIn()
        if (loggedIn) {
          const user = await getGoogleUserInfo()
          setUserInfo(user)
          setIsLoggedIn(true)
        }
      } catch (error) {
        console.error('Error loading settings:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      await saveAppSettingsToServer({
        oauth2ClientId: clientId,
        oauth2ClientSecret: clientSecret,
      })
      message.success('설정이 저장되었습니다.')
    } catch (error) {
      console.error('Error saving settings:', error)
      message.error('설정 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleLogin = () => {
    startGoogleLogin(clientId)
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>앱 설정</h2>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <Avatar size={64} icon={<UserOutlined />} style={{ marginRight: '10px' }} />
        <div>
          <p>계정명: {userInfo?.name}</p>
          <p>이메일: {userInfo?.email}</p>
        </div>
      </div>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSaveSettings}
        initialValues={{
          showBrowserWindow: true,
          taskDelay: 10,
          imageUploadFailureAction: 'fail',
        }}
      >
        <Form.Item label="OAuth2 Client ID">
          <Input value={clientId} onChange={e => setClientId(e.target.value)} />
        </Form.Item>
        <Form.Item label="OAuth2 Client Secret">
          <Input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" onClick={handleSaveSettings} loading={saving}>
              저장
            </Button>
            <Button type="primary" onClick={handleLogin}>
              Google OAuth 로그인
            </Button>
            {isLoggedIn && <Button type="default">로그아웃</Button>}
          </Space>
        </Form.Item>
      </Form>
    </div>
  )
}

export default AppSettingsForm
