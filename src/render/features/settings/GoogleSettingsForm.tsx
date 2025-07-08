import { Button, Form, Input, message, Space, Avatar, Select } from 'antd'
import React, { useEffect, useState, useRef } from 'react'
import {
  startGoogleLogin,
  getGoogleUserInfo,
  isGoogleLoggedIn,
  getBloggerBlogsFromServer,
  logoutGoogle,
} from '@render/api'
import { useGoogleSettings } from '@render/hooks/useSettings'
import { UserOutlined } from '@ant-design/icons'

const GoogleSettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const { googleSettings, updateGoogleSettings, isLoading, isSaving } = useGoogleSettings()
  const [userInfo, setUserInfo] = useState<any>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [blogList, setBlogList] = useState<any[]>([])
  const checkLoginInterval = useRef<NodeJS.Timeout>()

  // 초기 설정 로드 (한 번만 실행)
  useEffect(() => {
    const initializeSettings = () => {
      form.setFieldsValue({
        oauth2ClientId: googleSettings.oauth2ClientId || '',
        oauth2ClientSecret: googleSettings.oauth2ClientSecret || '',
        bloggerBlogId: googleSettings.bloggerBlogId || '',
      })
    }

    initializeSettings()
  }, [googleSettings, form])

  // 구글 로그인 상태 확인 및 블로그 목록 로드
  const checkGoogleLoginStatus = async () => {
    try {
      const loggedIn = await isGoogleLoggedIn()
      if (loggedIn) {
        const user = await getGoogleUserInfo()
        setUserInfo(user)
        setIsLoggedIn(true)
        const blogs = await getBloggerBlogsFromServer()
        setBlogList(blogs)
      } else {
        setUserInfo(null)
        setIsLoggedIn(false)
        setBlogList([])
        form.setFieldValue('bloggerBlogId', undefined)
      }
    } catch (error) {
      console.error('Error checking login status:', error)
    }
  }

  // 컴포넌트 마운트 시 한 번만 로그인 상태 확인
  useEffect(() => {
    checkGoogleLoginStatus()
  }, [])

  // 컴포넌트 언마운트 시 인터벌 정리
  useEffect(() => {
    return () => {
      if (checkLoginInterval.current) {
        clearInterval(checkLoginInterval.current)
      }
    }
  }, [])

  const handleSaveSettings = async (values: any) => {
    try {
      await updateGoogleSettings({
        oauth2ClientId: values.oauth2ClientId,
        oauth2ClientSecret: values.oauth2ClientSecret,
        bloggerBlogId: values.bloggerBlogId,
      })
    } catch (error) {
      // 에러는 훅에서 처리됨
    }
  }

  const handleLogin = () => {
    const clientId = form.getFieldValue('oauth2ClientId')
    if (!clientId) {
      message.error('OAuth2 Client ID를 먼저 입력해주세요.')
      return
    }

    startGoogleLogin(clientId)
    // 로그인 시도 후 상태 체크 인터벌 시작
    if (checkLoginInterval.current) {
      clearInterval(checkLoginInterval.current)
    }
    checkLoginInterval.current = setInterval(async () => {
      try {
        const loggedIn = await isGoogleLoggedIn()
        if (loggedIn) {
          await checkGoogleLoginStatus()
          if (checkLoginInterval.current) {
            clearInterval(checkLoginInterval.current)
          }
        }
      } catch (error) {
        console.error('Error checking login status:', error)
      }
    }, 2000) // 2초마다 체크

    // 30초 후에는 체크 중단
    setTimeout(() => {
      if (checkLoginInterval.current) {
        clearInterval(checkLoginInterval.current)
      }
    }, 30000)
  }

  const handleLogout = async () => {
    try {
      await logoutGoogle()
      setUserInfo(null)
      setIsLoggedIn(false)
      setBlogList([])
      form.setFieldValue('bloggerBlogId', undefined)
      message.success('로그아웃되었습니다.')
    } catch (error) {
      message.error('로그아웃 중 오류가 발생했습니다.')
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>구글 설정</h2>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <Avatar size={64} icon={<UserOutlined />} style={{ marginRight: '10px' }} />
        <div>
          <p>계정명: {userInfo?.name || '로그인이 필요합니다'}</p>
          <p>이메일: {userInfo?.email || '로그인이 필요합니다'}</p>
        </div>
      </div>
      <Form form={form} layout="vertical" onFinish={handleSaveSettings}>
        <Form.Item name="oauth2ClientId" label="OAuth2 Client ID">
          <Input placeholder="OAuth2 Client ID를 입력하세요" />
        </Form.Item>
        <Form.Item name="oauth2ClientSecret" label="OAuth2 Client Secret">
          <Input.Password placeholder="OAuth2 Client Secret을 입력하세요" />
        </Form.Item>
        <Form.Item label="Blogger 블로그 선택" name="bloggerBlogId">
          <Select
            placeholder="블로그를 선택하세요"
            loading={isLoading}
            options={blogList.map(blog => ({ label: `${blog.name}(${blog.id})`, value: blog.id }))}
            allowClear
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={isSaving}>
              저장
            </Button>
            <Button type="primary" onClick={handleLogin}>
              Google OAuth 로그인
            </Button>
            {isLoggedIn && (
              <Button type="default" onClick={handleLogout}>
                로그아웃
              </Button>
            )}
          </Space>
        </Form.Item>
      </Form>
    </div>
  )
}

export default GoogleSettingsForm
