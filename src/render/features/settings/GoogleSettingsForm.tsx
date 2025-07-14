import { Button, Form, Input, message, Space, Avatar, Select } from 'antd'
import React, { useEffect, useState, useRef } from 'react'
import {
  startGoogleLogin,
  getGoogleUserInfo,
  isGoogleLoggedIn,
  getBloggerBlogs,
  logoutGoogle,
  validateGoogleClientCredentials,
} from '@render/api'
import { useGoogleSettings } from '@render/hooks/useSettings'
import { UserOutlined } from '@ant-design/icons'
import { NormalizedError } from '@render/api/error.type'

// Blogger API 응답 타입 정의
interface BloggerBlog {
  kind: string
  id: string
  status: string
  name: string
  description: string
  published: string
  updated: string
  url: string
  selfLink: string
  posts: {
    totalItems: number
    selfLink: string
  }
  pages: {
    totalItems: number
    selfLink: string
  }
  locale: {
    language: string
    country: string
    variant: string
  }
}

interface BloggerBlogsResponse {
  blogs: {
    kind: string
    items: BloggerBlog[]
  }
}

const GoogleSettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const { googleSettings, updateGoogleSettings, isLoading, isSaving } = useGoogleSettings()
  const [userInfo, setUserInfo] = useState<any>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [blogList, setBlogList] = useState<BloggerBlog[]>([])
  const checkLoginInterval = useRef<NodeJS.Timeout>()
  const [isValidating, setIsValidating] = useState(false)

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
        const blogsResponse: BloggerBlogsResponse = await getBloggerBlogs()
        setBlogList(Array.isArray(blogsResponse?.blogs?.items) ? blogsResponse.blogs.items : [])
      } else {
        setUserInfo(null)
        setIsLoggedIn(false)
        setBlogList([])
        form.setFieldValue('bloggerBlogId', undefined)
      }
    } catch (error) {
      console.error('Error checking login status:', error)
      setBlogList([])
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

  const handleLogin = async () => {
    const clientId = form.getFieldValue('oauth2ClientId')
    const clientSecret = form.getFieldValue('oauth2ClientSecret')
    if (!clientId || !clientSecret) {
      message.error('OAuth2 Client ID와 Client Secret을 모두 입력하고 저장해주세요.')
      return
    }
    // 저장 먼저 시도
    try {
      await handleSaveSettings(form.getFieldsValue())
      message.success('설정이 저장되었습니다. 이제 Google OAuth 로그인을 진행합니다.')
    } catch (error) {
      message.error('설정 저장에 실패했습니다. 저장 후 다시 시도해주세요.')
      return
    }
    // 저장 성공 후 로그인 시도
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

  // 클라이언트 ID/시크릿 검증 함수
  const handleValidateCredentials = async () => {
    const clientId = form.getFieldValue('oauth2ClientId')
    const clientSecret = form.getFieldValue('oauth2ClientSecret')
    if (!clientId || !clientSecret) {
      message.error('OAuth2 Client ID와 Client Secret을 모두 입력해주세요.')
      return
    }
    setIsValidating(true)
    try {
      const result = await validateGoogleClientCredentials(clientId, clientSecret)
      if (result.valid) {
        message.success('클라이언트 ID/시크릿이 정상입니다.')
      } else {
        message.error(result.error || '클라이언트 정보가 올바르지 않습니다.')
      }
    } catch (error) {
      // errorNormalizer로 정규화된 에러 사용
      const err = error as NormalizedError
      if (err.errorCode === 4106) {
        message.error(err.message || '클라이언트 ID 또는 시크릿이 잘못되었습니다.')
      } else {
        message.error(err.message || '검증 중 오류가 발생했습니다.')
      }
    } finally {
      setIsValidating(false)
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
        <Form.Item name="oauth2ClientId" label="클라이언트 ID">
          <Input placeholder="클라이언트 ID를 입력하세요" />
        </Form.Item>
        <Form.Item name="oauth2ClientSecret" label="클라이언트 보안 비밀번호">
          <Input.Password placeholder="클라이언트 보안 비밀번호를 입력하세요" />
        </Form.Item>
        <Form.Item>
          <Button type="default" onClick={handleValidateCredentials} loading={isValidating}>
            클라이언트 정보 검증
          </Button>
        </Form.Item>
        <Form.Item label="블로그스팟 블로그 선택" name="bloggerBlogId">
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
