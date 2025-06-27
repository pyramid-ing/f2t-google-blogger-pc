import { Button, Form, Input, message, Space, Avatar, Select } from 'antd'
import React, { useEffect, useState } from 'react'
import {
  getAppSettingsFromServer,
  saveAppSettingsToServer,
  startGoogleLogin,
  getGoogleUserInfo,
  isGoogleLoggedIn,
  getBloggerBlogsFromServer,
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
  const [blogList, setBlogList] = useState<any[]>([])
  const [selectedBlogId, setSelectedBlogId] = useState<string | undefined>(undefined)

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true)
      try {
        const settings = await getAppSettingsFromServer()
        setClientId(settings.oauth2ClientId || '')
        setClientSecret(settings.oauth2ClientSecret || '')
        form.setFieldsValue(settings)
        setSelectedBlogId(settings.bloggerBlogId)

        const loggedIn = await isGoogleLoggedIn()
        if (loggedIn) {
          const user = await getGoogleUserInfo()
          setUserInfo(user)
          setIsLoggedIn(true)
          const blogs = await getBloggerBlogsFromServer()
          setBlogList(blogs)
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
      const settings = await getAppSettingsFromServer()

      await saveAppSettingsToServer({
        ...settings,
        oauth2ClientId: clientId,
        oauth2ClientSecret: clientSecret,
        bloggerBlogId: selectedBlogId,
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
        <Form.Item label="Blogger 블로그 선택">
          <Select
            value={selectedBlogId}
            onChange={setSelectedBlogId}
            placeholder="블로그를 선택하세요"
            loading={loading}
            options={blogList.map(blog => ({ label: `${blog.name}(${blog.id})`, value: blog.id }))}
            allowClear
          />
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
