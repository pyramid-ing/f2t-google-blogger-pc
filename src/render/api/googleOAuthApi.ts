import { api } from './apiClient'

export async function getGoogleOAuthStatus() {
  const res = await api.get('/google-oauth/status')
  return res.data
}

export async function googleOAuthLogout() {
  const res = await api.post('/google-oauth/logout')
  return res.data
}

export async function refreshGoogleToken() {
  const res = await api.post('/google-oauth/refresh-token')
  return res.data
}

const GOOGLE_REDIRECT_URI = 'http://localhost:3554/google-oauth/callback'
const GOOGLE_SCOPE = [
  'https://www.googleapis.com/auth/blogger',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ')

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

export async function getGoogleAuthStatus() {
  try {
    const response = await getGoogleOAuthStatus()
    return response
  } catch (error: any) {
    console.error('Google OAuth 상태 확인 오류:', error)
    return {
      isLoggedIn: false,
      message: '상태 확인 실패',
      error: error.message,
    }
  }
}

export async function logoutGoogle() {
  try {
    const response = await googleOAuthLogout()
    return response
  } catch (error) {
    console.error('Google OAuth 로그아웃 오류:', error)
    throw error
  }
}

export async function isGoogleLoggedIn(): Promise<boolean> {
  try {
    const status = await getGoogleAuthStatus()
    return status.isLoggedIn || false
  } catch (error) {
    return false
  }
}

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

export function startGoogleLogin(clientId: string) {
  if (!clientId.trim()) {
    throw new Error('OAuth2 Client ID가 필요합니다.')
  }
  const authUrl = generateGoogleAuthUrl(clientId)
  window.electronAPI.openExternal(authUrl)
  return {
    success: true,
    message: '브라우저에서 Google 로그인을 완료하세요. 인증이 완료되면 자동으로 처리됩니다.',
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  try {
    const status = await getGoogleAuthStatus()
    if (status.isLoggedIn) {
      return 'valid'
    }
    return null
  } catch (error) {
    console.error('토큰 확인 실패:', error)
    return null
  }
}
