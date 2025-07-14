import { Button, Form, message, Space, Avatar, Select } from 'antd'
import React, { useEffect, useState, useRef } from 'react'
import { startGoogleLogin, getGoogleUserInfo, isGoogleLoggedIn, getBloggerBlogs, logoutGoogle } from '@render/api'
import { useGoogleSettings } from '@render/hooks/useSettings'
import { UserOutlined } from '@ant-design/icons'

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

// Google OAuth Client ID 상수 선언
const GOOGLE_CLIENT_ID = '365896770281-rrr9tqujl2qvgsl2srdl8ccjse9dp86t.apps.googleusercontent.com'

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
        bloggerBlogId: values.bloggerBlogId,
      })
    } catch (error) {
      // 에러는 훅에서 처리됨
    }
  }

  const handleLogin = async () => {
    startGoogleLogin(GOOGLE_CLIENT_ID)
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
    }, 2000)
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
      form.setFieldValue('bloggerBlogId', '')
      await updateGoogleSettings({ bloggerBlogId: undefined })
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
              Google 로그인
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
