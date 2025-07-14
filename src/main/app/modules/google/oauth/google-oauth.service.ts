import { Injectable, Logger } from '@nestjs/common'
import { SettingsService } from '../../settings/settings.service'
import { AppSettings } from '@render/types/settings'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

@Injectable()
export class GoogleOauthService {
  private readonly logger = new Logger(GoogleOauthService.name)

  constructor(private readonly settingsService: SettingsService) {}

  /**
   * 저장된 Google OAuth 토큰 가져오기
   */
  async getAccessToken(): Promise<string> {
    try {
      const settings = await this.settingsService.getSettings()
      const { oauth2AccessToken, oauth2RefreshToken, oauth2TokenExpiry, oauth2ClientId, oauth2ClientSecret } = settings

      if (!oauth2AccessToken) {
        throw new CustomHttpException(ErrorCode.AUTH_REQUIRED, {
          message: 'Google OAuth 토큰이 없습니다. 먼저 로그인해주세요.',
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
          throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
            message: `Google 토큰 갱신 실패: ${refreshError.message}. 다시 로그인해주세요.`,
            originalError: refreshError.message,
          })
        }
      }

      return oauth2AccessToken
    } catch (error: any) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: error.message || '네트워크 오류',
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
        throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
          message: errorData.error_description || 'Token 갱신 실패',
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
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `토큰 갱신 중 네트워크 오류: ${error.message}`,
        originalError: error.message,
      })
    }
  }

  /**
   * OAuth 콜백 처리 및 토큰 저장
   */
  async processOAuthCallback(code: string) {
    try {
      const settings = await this.settingsService.getSettings()
      if (!settings) {
        throw new CustomHttpException(ErrorCode.INVALID_INPUT, {
          message: 'Google 설정이 존재하지 않습니다.',
          configType: 'global_settings',
        })
      }
      const { oauth2ClientId, oauth2ClientSecret } = settings
      if (!oauth2ClientId || !oauth2ClientSecret) {
        throw new CustomHttpException(ErrorCode.INVALID_INPUT, {
          message: 'OAuth2 Client ID 또는 Client Secret이 설정되지 않았습니다.',
          hasClientId: !!oauth2ClientId,
          hasClientSecret: !!oauth2ClientSecret,
        })
      }
      const tokens = await this.exchangeCodeForTokens(code, oauth2ClientId, oauth2ClientSecret)
      const userInfo = await this.getGoogleUserInfo(tokens.accessToken)
      const updatedGoogleSettings = {
        ...settings,
        oauth2AccessToken: tokens.accessToken,
        oauth2RefreshToken: tokens.refreshToken,
        oauth2TokenExpiry: new Date(tokens.expiresAt).toISOString(),
      }
      await this.settingsService.updateSettings(updatedGoogleSettings)
      this.logger.log('OAuth 토큰 저장 완료')
      return { tokens, userInfo }
    } catch (error: any) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `OAuth 콜백 처리 실패: ${error.message}`,
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
        throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
          message: `토큰 교환 실패: ${errorData.error_description || errorData.error}`,
          httpStatus: response.status,
          errorData,
        })
      }
      const data = await response.json()
      if (!data.access_token) {
        throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
          message: 'Google에서 유효한 액세스 토큰을 받지 못했습니다.',
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
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `토큰 교환 중 네트워크 오류: ${error.message}`,
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
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: '사용자 정보 조회 실패',
        httpStatus: response.status,
      })
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
        throw new CustomHttpException(ErrorCode.AUTH_REQUIRED, { message: 'Refresh token이 없습니다.' })
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
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `토큰 갱신 실패: ${error.message}`,
        originalError: error.message,
      })
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
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `로그아웃 실패: ${error.message}`,
        originalError: error.message,
      })
    }
  }

  /**
   * 클라이언트 ID/시크릿 유효성 검증
   */
  async validateClientCredentials(clientId: string, clientSecret: string) {
    // 임의의 잘못된 code로 토큰 요청을 시도하여 clientId/clientSecret 유효성만 체크
    const fakeCode = 'invalid_code_for_validation'
    const requestBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: fakeCode,
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
    const data = await response.json()
    // clientId/clientSecret이 잘못된 경우 error: 'unauthorized_client' 또는 'invalid_client' 등 반환
    if (data.error === 'unauthorized_client' || data.error === 'invalid_client') {
      throw new CustomHttpException(ErrorCode.INVALID_CLIENT_CREDENTIALS, {
        message: '클라이언트 ID 또는 시크릿이 잘못되었습니다.',
        responseData: data,
      })
    }
    // code가 잘못된 경우 error: 'invalid_grant' 등 반환 → 이 경우는 clientId/secret이 맞다는 의미
    if (data.error === 'invalid_grant') {
      return { valid: true }
    }
  }
}
