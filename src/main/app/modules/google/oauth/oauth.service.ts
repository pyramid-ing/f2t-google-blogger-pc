import { Injectable, Logger } from '@nestjs/common'
import { SettingsService } from '../../settings/settings.service'
import { AppSettings } from '@render/types/settings'

// 에러 클래스 정의
export class GoogleAuthError extends Error {
  constructor(
    message: string,
    public operation: string,
    public details?: any,
  ) {
    super(message)
    this.name = 'GoogleAuthError'
  }
}
export class GoogleTokenError extends Error {
  constructor(
    message: string,
    public operation: string,
    public isAuthError: boolean,
    public details?: any,
  ) {
    super(message)
    this.name = 'GoogleTokenError'
  }
}
export class GoogleConfigError extends Error {
  constructor(
    message: string,
    public operation: string,
    public details?: any,
  ) {
    super(message)
    this.name = 'GoogleConfigError'
  }
}

@Injectable()
export class OauthService {
  private readonly logger = new Logger(OauthService.name)

  constructor(private readonly settingsService: SettingsService) {}

  /**
   * 저장된 Google OAuth 토큰 가져오기
   */
  async getAccessToken(): Promise<string> {
    try {
      const settings = await this.settingsService.getSettings()
      const { oauth2AccessToken, oauth2RefreshToken, oauth2TokenExpiry, oauth2ClientId, oauth2ClientSecret } = settings

      if (!oauth2AccessToken) {
        throw new GoogleAuthError('Google OAuth 토큰이 없습니다. 먼저 로그인해주세요.', 'getAccessToken', {
          hasRefreshToken: !!oauth2RefreshToken,
        })
      }

      // 토큰 만료 확인
      const expiryTime = oauth2TokenExpiry ? new Date(oauth2TokenExpiry).getTime() : 0
      const isExpired = Date.now() >= expiryTime - 60000 // 1분 여유

      if (isExpired && oauth2RefreshToken) {
        this.logger.log('Google 토큰 만료 감지, 자동 갱신 시도...')
        try {
          const newTokens = await this.refreshAccessToken(oauth2RefreshToken, oauth2ClientId, oauth2ClientSecret)
          const updatedSetting = {
            ...settings,
            oauth2AccessToken: newTokens.accessToken,
            oauth2TokenExpiry: new Date(newTokens.expiresAt).toISOString(),
          }
          await this.settingsService.updateSettings(updatedSetting)
          this.logger.log('Google 토큰이 자동으로 갱신되었습니다.')
          return newTokens.accessToken
        } catch (refreshError: any) {
          throw new GoogleTokenError(
            `Google 토큰 갱신 실패: ${refreshError.message}. 다시 로그인해주세요.`,
            'refreshAccessToken',
            true,
            { originalError: refreshError.message },
          )
        }
      }

      return oauth2AccessToken
    } catch (error: any) {
      if (error instanceof GoogleConfigError || error instanceof GoogleAuthError || error instanceof GoogleTokenError) {
        throw error
      }
      throw new GoogleAuthError(`Google 인증 토큰 가져오기 실패: ${error.message}`, 'getAccessToken', {
        originalError: error.message,
      })
    }
  }

  /**
   * Refresh Token으로 Access Token 갱신
   */
  async refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new GoogleTokenError(errorData.error_description || 'Token 갱신 실패', 'refreshAccessToken', false, {
          httpStatus: response.status,
          errorData,
        })
      }

      const data = await response.json()
      return {
        accessToken: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      }
    } catch (error: any) {
      if (error instanceof GoogleTokenError) {
        throw error
      }
      throw new GoogleTokenError(`토큰 갱신 중 네트워크 오류: ${error.message}`, 'refreshAccessToken', false, {
        originalError: error.message,
      })
    }
  }

  /**
   * OAuth 콜백 처리 및 토큰 저장
   */
  async processOAuthCallback(code: string) {
    try {
      const globalSettings = await this.settingsService.getSettings()
      if (!globalSettings) {
        throw new GoogleConfigError('Google 설정이 존재하지 않습니다.', 'processOAuthCallback', 'global_settings')
      }
      const { oauth2ClientId, oauth2ClientSecret } = globalSettings
      if (!oauth2ClientId || !oauth2ClientSecret) {
        throw new GoogleConfigError(
          'OAuth2 Client ID 또는 Client Secret이 설정되지 않았습니다.',
          'processOAuthCallback',
          {
            hasClientId: !!oauth2ClientId,
            hasClientSecret: !!oauth2ClientSecret,
          },
        )
      }
      const tokens = await this.exchangeCodeForTokens(code, oauth2ClientId, oauth2ClientSecret)
      const userInfo = await this.getGoogleUserInfo(tokens.accessToken)
      const updatedGoogleSettings = {
        ...globalSettings,
        oauth2AccessToken: tokens.accessToken,
        oauth2RefreshToken: tokens.refreshToken,
        oauth2TokenExpiry: new Date(tokens.expiresAt).toISOString(),
      }
      await this.settingsService.updateSettings(updatedGoogleSettings)
      this.logger.log('OAuth 토큰 저장 완료')
      return { tokens, userInfo }
    } catch (error: any) {
      if (error instanceof GoogleAuthError || error instanceof GoogleConfigError || error instanceof GoogleTokenError) {
        throw error
      }
      throw new GoogleAuthError(`OAuth 콜백 처리 실패: ${error.message}`, 'processOAuthCallback', {
        hasCode: !!code,
        originalError: error.message,
      })
    }
  }

  /**
   * 인증 코드로 토큰 교환
   */
  async exchangeCodeForTokens(code: string, clientId: string, clientSecret: string) {
    try {
      const requestBody = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: 'http://localhost:3554/google-oauth/callback',
      })
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: requestBody,
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new GoogleTokenError(
          `토큰 교환 실패: ${errorData.error_description || errorData.error}`,
          'exchangeCodeForTokens',
          false,
          {
            httpStatus: response.status,
            errorData,
          },
        )
      }
      const data = await response.json()
      if (!data.access_token) {
        throw new GoogleTokenError('Google에서 유효한 액세스 토큰을 받지 못했습니다.', 'exchangeCodeForTokens', false, {
          responseData: data,
        })
      }
      this.logger.log('Google 토큰 교환 성공')
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
        scope: data.scope,
      }
    } catch (error: any) {
      if (error instanceof GoogleTokenError) {
        throw error
      }
      throw new GoogleTokenError(`토큰 교환 중 네트워크 오류: ${error.message}`, 'exchangeCodeForTokens', false, {
        originalError: error.message,
      })
    }
  }

  /**
   * 액세스 토큰으로 사용자 정보 조회
   */
  async getGoogleUserInfo(accessToken: string) {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    if (!response.ok) {
      throw new Error('사용자 정보 조회 실패')
    }
    return await response.json()
  }

  /**
   * 토큰 갱신
   */
  async refreshToken() {
    try {
      const appSettings = await this.settingsService.getSettings()
      const { oauth2ClientId, oauth2ClientSecret, oauth2RefreshToken } = appSettings
      if (!oauth2RefreshToken) {
        throw new Error('Refresh token이 없습니다.')
      }
      const newTokens = await this.refreshAccessToken(oauth2RefreshToken, oauth2ClientId, oauth2ClientSecret)
      const updatedSettings: AppSettings = {
        ...appSettings,
        oauth2AccessToken: newTokens.accessToken,
        oauth2TokenExpiry: new Date(newTokens.expiresAt).toISOString(),
      }
      await this.settingsService.updateSettings(updatedSettings)
      return {
        success: true,
        message: '토큰이 성공적으로 갱신되었습니다.',
        accessToken: newTokens.accessToken,
      }
    } catch (error: any) {
      throw new Error(`토큰 갱신 실패: ${error.message}`)
    }
  }

  /**
   * 현재 OAuth 상태 확인
   */
  async getOAuthStatus() {
    try {
      const globalSettings = await this.settingsService.getSettings()
      const { oauth2AccessToken, oauth2RefreshToken, oauth2TokenExpiry } = globalSettings
      if (!oauth2AccessToken) {
        return {
          isLoggedIn: false,
          message: '로그인이 필요합니다.',
        }
      }
      // 토큰 만료 확인
      const expiryTime = oauth2TokenExpiry ? new Date(oauth2TokenExpiry).getTime() : 0
      const isExpired = Date.now() >= expiryTime - 60000 // 1분 여유
      if (isExpired && oauth2RefreshToken) {
        // 자동으로 토큰 갱신 시도
        try {
          await this.refreshToken()
          const userInfo = await this.getGoogleUserInfo(globalSettings.oauth2AccessToken)
          return {
            isLoggedIn: true,
            userInfo,
            message: '토큰이 자동으로 갱신되었습니다.',
          }
        } catch (error) {
          return {
            isLoggedIn: false,
            message: '토큰 갱신 실패. 다시 로그인해주세요.',
          }
        }
      }
      // 유효한 토큰으로 사용자 정보 가져오기
      const userInfo = await this.getGoogleUserInfo(oauth2AccessToken)
      return {
        isLoggedIn: true,
        userInfo,
        message: '로그인 상태입니다.',
      }
    } catch (error: any) {
      return {
        isLoggedIn: false,
        message: '로그인 상태 확인 실패.',
        error: error.message,
      }
    }
  }

  /**
   * 로그아웃 (토큰 삭제)
   */
  async logout() {
    try {
      const globalSettings = await this.settingsService.getSettings()
      const updatedGoogleSettings = {
        ...globalSettings,
        oauth2AccessToken: '',
        oauth2RefreshToken: '',
        oauth2TokenExpiry: '',
      }
      await this.settingsService.updateSettings(updatedGoogleSettings)
      return {
        success: true,
        message: 'Google 계정 연동이 해제되었습니다.',
      }
    } catch (error: any) {
      throw new Error(`로그아웃 실패: ${error.message}`)
    }
  }
}
