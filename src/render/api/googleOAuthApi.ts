import { api } from './apiClient'

export async function getGoogleOAuthStatus() {
  const res = await api.get('/google-oauth/status')
  return res.data
}

export async function googleOAuthLogout() {
  const res = await api.post('/google-oauth/logout')
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
  const response = await getGoogleOAuthStatus()
  return response
}

export async function logoutGoogle() {
  const response = await googleOAuthLogout()
  return response
}

export async function isGoogleLoggedIn(): Promise<boolean> {
  const status = await getGoogleAuthStatus()
  return status.isLoggedIn || false
}

export async function getGoogleUserInfo(): Promise<any> {
  const status = await getGoogleAuthStatus()
  if (status.isLoggedIn && status.userInfo) {
    return status.userInfo
  }
  throw new Error('로그인되지 않았거나 사용자 정보가 없습니다.')
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

export async function validateGoogleClientCredentials(clientId: string, clientSecret: string) {
  const res = await api.post('/google-oauth/validate-credentials', { clientId, clientSecret })
  return res.data
}
