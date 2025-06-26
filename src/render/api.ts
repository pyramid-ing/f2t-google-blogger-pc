import type { AppSettings } from './types/settings'

// ------------------------------
// App Settings API
// ------------------------------

import axios from 'axios'

const API_BASE_URL = 'http://localhost:3554'

// 에러 코드 enum
export enum ErrorCode {}

// 정규화된 에러 응답 타입
export interface ErrorResponse {
  success: false
  statusCode: number
  timestamp: string
  path: string
  error: string
  message: string
  code?: ErrorCode
  service?: string
  operation?: string
  details?: {
    stack?: string[]
    name?: string
    url?: string
    method?: string
    response?: any
    code?: string
    category?: string
    postData?: any
    ffmpegError?: string
    inputData?: any
    siteUrl?: string
    blogId?: string
    postId?: string
    configType?: string
    isExpired?: boolean
    additionalInfo?: Record<string, any>
  }
}

// 에러 메시지 생성 헬퍼 함수
export function getErrorMessage(error: any): string {
  if (error.response?.data) {
    const errorData = error.response.data as ErrorResponse

    // 정규화된 에러 구조인 경우
    if (errorData.code && errorData.service && errorData.operation) {
      return `[${errorData.service}/${errorData.operation}] ${errorData.message}`
    }

    // 기본 에러 메시지
    return errorData.message || error.message
  }

  return error.message || '알 수 없는 오류가 발생했습니다.'
}

// 에러 상세 정보 생성 헬퍼 함수
export function getErrorDetails(error: any): string | undefined {
  if (error.response?.data?.details?.additionalInfo) {
    const details = error.response.data.details.additionalInfo
    const detailStrings = []

    for (const [key, value] of Object.entries(details)) {
      if (typeof value === 'boolean') {
        detailStrings.push(`${key}: ${value ? '있음' : '없음'}`)
      } else if (typeof value === 'string' || typeof value === 'number') {
        detailStrings.push(`${key}: ${value}`)
      }
    }

    return detailStrings.length > 0 ? detailStrings.join(', ') : undefined
  }

  return undefined
}

// OpenAI API 키 서버 저장/불러오기
export async function saveOpenAIApiKeyToServer(key: string) {
  const res = await axios.post(`${API_BASE_URL}/settings/global`, { openAIApiKey: key })
  return res.data
}

export async function getOpenAIApiKeyFromServer(): Promise<string> {
  const res = await axios.get(`${API_BASE_URL}/settings/global`)
  return res.data?.data?.openAIApiKey || ''
}

// OpenAI API 키 검증
export async function validateOpenAIApiKey(apiKey: string): Promise<{
  valid: boolean
  error?: string
  model?: string
}> {
  const res = await axios.post(`${API_BASE_URL}/settings/validate-openai-key`, { apiKey })
  return res.data
}

export async function saveAppSettingsToServer(settings: AppSettings) {
  const res = await axios.post(`${API_BASE_URL}/settings/app`, settings)
  return res.data
}

export async function getAppSettingsFromServer(): Promise<AppSettings> {
  const res = await axios.get(`${API_BASE_URL}/settings/app`)
  return res.data?.data
}

// Google OAuth 관련 - 서버 기반 처리
export async function getGoogleOAuthStatus() {
  const res = await axios.get(`${API_BASE_URL}/google-oauth/status`)
  return res.data
}

export async function googleOAuthLogout() {
  const res = await axios.post(`${API_BASE_URL}/google-oauth/logout`)
  return res.data
}

export async function refreshGoogleToken() {
  const res = await axios.post(`${API_BASE_URL}/google-oauth/refresh-token`)
  return res.data
}

// OAuth2 설정
const GOOGLE_REDIRECT_URI = 'http://localhost:3554/google-oauth/callback'
const GOOGLE_SCOPE = [
  'https://www.googleapis.com/auth/blogger',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ')

export interface GoogleTokens {
  accessToken: string
  refreshToken?: string
  expiresAt: number
}

// OAuth2 인증 URL 생성
export function generateGoogleAuthUrl(clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: GOOGLE_REDIRECT_URI,
    scope: GOOGLE_SCOPE,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

// 서버에서 Google OAuth 상태 확인
export async function getGoogleAuthStatus() {
  try {
    const response = await getGoogleOAuthStatus()
    return response
  } catch (error) {
    console.error('Google OAuth 상태 확인 오류:', error)
    return {
      isLoggedIn: false,
      message: '상태 확인 실패',
      error: error.message,
    }
  }
}

// 서버에서 Google OAuth 로그아웃
export async function logoutGoogle() {
  try {
    const response = await googleOAuthLogout()
    return response
  } catch (error) {
    console.error('Google OAuth 로그아웃 오류:', error)
    throw error
  }
}

// 로그인 상태 확인 (서버 기반)
export async function isGoogleLoggedIn(): Promise<boolean> {
  try {
    const status = await getGoogleAuthStatus()
    return status.isLoggedIn || false
  } catch (error) {
    return false
  }
}

// 사용자 정보 가져오기 (서버에서 저장된 토큰 사용)
export async function getGoogleUserInfo(): Promise<any> {
  try {
    const status = await getGoogleAuthStatus()
    if (status.isLoggedIn && status.userInfo) {
      return status.userInfo
    }
    throw new Error('로그인되지 않았거나 사용자 정보가 없습니다.')
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error)
    throw error
  }
}

// 로그인 프로세스 시작 (브라우저에서 OAuth 진행)
export function startGoogleLogin(clientId: string) {
  if (!clientId.trim()) {
    throw new Error('OAuth2 Client ID가 필요합니다.')
  }

  const authUrl = generateGoogleAuthUrl(clientId)

  // Electron에서 외부 브라우저로 열기
  if ((window as any).electron?.shell?.openExternal) {
    ;(window as any).electron.shell.openExternal(authUrl)
  } else {
    window.open(authUrl, '_blank')
  }

  return {
    success: true,
    message: '브라우저에서 Google 로그인을 완료하세요. 인증이 완료되면 자동으로 처리됩니다.',
  }
}

// 유효한 Access Token 가져오기 (서버에서 자동 갱신)
export async function getValidAccessToken(): Promise<string | null> {
  try {
    const status = await getGoogleAuthStatus()
    if (status.isLoggedIn) {
      // 서버에서 자동으로 토큰 갱신을 처리하므로 별도 처리 불필요
      return 'valid' // 실제 토큰 값은 서버에서 관리
    }
    return null
  } catch (error) {
    console.error('토큰 확인 실패:', error)
    return null
  }
}

// 주제 찾기
export async function findTopics(topic: string, limit: number = 10) {
  const response = await axios.get(`${API_BASE_URL}/workflow/find-topics`, {
    params: { topic, limit },
    responseType: 'blob',
  })
  return response.data
}

// 워크플로우 등록
export async function registerWorkflow(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await axios.post(`${API_BASE_URL}/workflow/post`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}
