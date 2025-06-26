import { GoogleAuthError, GoogleConfigError, GoogleTokenError } from '@main/filters/error.types'
import { Body, Controller, Get, Logger, Post, Query, Res } from '@nestjs/common'
import { Response } from 'express'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { AppSettings } from '@render/types/settings'

@Controller('google-oauth')
export class GoogleOAuthController {
  private readonly logger = new Logger(GoogleOAuthController.name)

  constructor(private readonly settingsService: SettingsService) {}

  @Get('callback')
  async handleCallback(@Query('code') code: string, @Query('error') error: string, @Res() res: Response) {
    if (error) {
      // OAuth 인증 실패
      this.logger.error(`OAuth 인증 실패: ${error}`)
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>OAuth 인증 실패</title>
          <meta charset="utf-8">
        </head>
        <body>
          <h1>OAuth 인증 실패</h1>
          <p>오류: ${error}</p>
          <p>이 창을 닫고 다시 시도해주세요.</p>
          <script>
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
        </html>
      `)
    }

    if (!code) {
      // 인증 코드가 없음
      this.logger.error('OAuth 콜백에서 인증 코드를 받지 못함')
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>OAuth 인증 오류</title>
          <meta charset="utf-8">
        </head>
        <body>
          <h1>OAuth 인증 오류</h1>
          <p>인증 코드를 받지 못했습니다.</p>
          <p>이 창을 닫고 다시 시도해주세요.</p>
          <script>
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
        </html>
      `)
    }

    try {
      // 서버에서 자동으로 토큰 교환 및 저장 처리
      await this.processOAuthCallback(code)

      this.logger.log('OAuth 인증 완료 - 성공 페이지 반환')
      // 성공 페이지 반환
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>OAuth 인증 완료</title>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              text-align: center;
            }
            .success-box {
              background-color: #f6ffed;
              border: 2px solid #52c41a;
              border-radius: 8px;
              padding: 30px;
              margin: 20px 0;
            }
            .btn {
              background-color: #1890ff;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 4px;
              cursor: pointer;
              margin: 10px;
              font-size: 16px;
            }
            .btn:hover {
              background-color: #40a9ff;
            }
          </style>
        </head>
        <body>
          <div class="success-box">
            <h1>✅ Google OAuth 인증 완료!</h1>
            <p>Google 계정 연동이 성공적으로 완료되었습니다.</p>
            <p>이제 이 창을 닫고 애플리케이션으로 돌아가세요.</p>
          </div>
          
          <button class="btn" onclick="window.close()">창 닫기</button>
          
          <script>
            // 5초 후 자동으로 창 닫기
            setTimeout(() => {
              window.close();
            }, 5000);
          </script>
        </body>
        </html> 
      `)
    } catch (error) {
      this.logger.error('OAuth 콜백 처리 오류:', error)

      const errorMessage =
        error instanceof GoogleAuthError || error instanceof GoogleConfigError || error instanceof GoogleTokenError
          ? `${error.service} ${error.operation}: ${error.message}`
          : error.message

      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>OAuth 처리 오류</title>
          <meta charset="utf-8">
        </head>
        <body>
          <h1>OAuth 처리 오류</h1>
          <p>토큰 처리 중 오류가 발생했습니다: ${errorMessage}</p>
          <p>이 창을 닫고 다시 시도해주세요.</p>
          <script>
            setTimeout(() => {
              window.close();
            }, 5000);
          </script>
        </body>
        </html>
      `)
    }
  }

  @Post('exchange-tokens')
  async exchangeTokens(@Body() body: { code: string }) {
    try {
      const result = await this.processOAuthCallback(body.code)
      return {
        success: true,
        message: 'Google 토큰이 성공적으로 저장되었습니다.',
        userInfo: result.userInfo,
      }
    } catch (error) {
      this.logger.error('토큰 교환 실패:', error)

      if (error instanceof GoogleAuthError || error instanceof GoogleConfigError || error instanceof GoogleTokenError) {
        throw error
      }

      throw new GoogleAuthError(`토큰 교환 실패: ${error.message}`, 'exchangeTokens', {
        code: body.code ? '***provided***' : 'missing',
      })
    }
  }

  private async processOAuthCallback(code: string) {
    try {
      // 현재 저장된 Google 설정에서 Client ID와 Secret 가져오기
      const globalSettings = await this.settingsService.getAppSettings()

      if (!globalSettings) {
        throw new GoogleConfigError('Google 설정이 존재하지 않습니다.', 'processOAuthCallback', 'global_settings')
      }

      const { oauth2ClientId, oauth2ClientSecret } = globalSettings

      if (!oauth2ClientId || !oauth2ClientSecret) {
        throw new GoogleConfigError(
          'OAuth2 Client ID 또는 Client Secret이 설정되지 않았습니다.',
          'processOAuthCallback',
          'oauth_credentials',
          {
            hasClientId: !!oauth2ClientId,
            hasClientSecret: !!oauth2ClientSecret,
          },
        )
      }

      // Google OAuth2 토큰 교환
      const tokens = await this.exchangeCodeForTokens(code, oauth2ClientId, oauth2ClientSecret)

      // 사용자 정보 가져오기
      const userInfo = await this.getGoogleUserInfo(tokens.accessToken)

      // DB에 토큰 저장
      const updatedGoogleSettings = {
        ...globalSettings,
        oauth2AccessToken: tokens.accessToken,
        oauth2RefreshToken: tokens.refreshToken,
        oauth2TokenExpiry: new Date(tokens.expiresAt).toISOString(),
      }

      await this.settingsService.updateAppSettings(updatedGoogleSettings)

      this.logger.log('OAuth 토큰 저장 완료')
      return { tokens, userInfo }
    } catch (error) {
      if (error instanceof GoogleAuthError || error instanceof GoogleConfigError || error instanceof GoogleTokenError) {
        throw error
      }

      throw new GoogleAuthError(`OAuth 콜백 처리 실패: ${error.message}`, 'processOAuthCallback', {
        hasCode: !!code,
        originalError: error.message,
      })
    }
  }

  private async exchangeCodeForTokens(code: string, clientId: string, clientSecret: string) {
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
    } catch (error) {
      if (error instanceof GoogleTokenError) {
        throw error
      }

      throw new GoogleTokenError(`토큰 교환 중 네트워크 오류: ${error.message}`, 'exchangeCodeForTokens', false, {
        originalError: error.message,
      })
    }
  }

  private async getGoogleUserInfo(accessToken: string) {
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

  // 토큰 갱신 엔드포인트
  @Post('refresh-token')
  async refreshToken() {
    try {
      const appSettings = await this.settingsService.getAppSettings()
      const { oauth2ClientId, oauth2ClientSecret, oauth2RefreshToken } = appSettings

      if (!oauth2RefreshToken) {
        throw new Error('Refresh token이 없습니다.')
      }

      const newTokens = await this.refreshAccessToken(oauth2RefreshToken, oauth2ClientId, oauth2ClientSecret)

      // DB에 새로운 토큰 저장
      const updatedSettings: AppSettings = {
        ...appSettings,
        oauth2AccessToken: newTokens.accessToken,
        oauth2TokenExpiry: new Date(newTokens.expiresAt).toISOString(),
      }

      await this.settingsService.updateAppSettings(updatedSettings)

      return {
        success: true,
        message: '토큰이 성공적으로 갱신되었습니다.',
        accessToken: newTokens.accessToken,
      }
    } catch (error) {
      throw new Error(`토큰 갱신 실패: ${error.message}`)
    }
  }

  private async refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
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
      throw new Error(errorData.error_description || 'Token 갱신 실패')
    }

    const data = await response.json()
    return {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    }
  }

  // 현재 토큰 상태 확인
  @Get('status')
  async getOAuthStatus() {
    try {
      const globalSettings = await this.settingsService.getAppSettings()
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
    } catch (error) {
      return {
        isLoggedIn: false,
        message: '로그인 상태 확인 실패.',
        error: error.message,
      }
    }
  }

  // 로그아웃 (토큰 삭제)
  @Post('logout')
  async logout() {
    try {
      const globalSettings = await this.settingsService.getAppSettings()
      const updatedGoogleSettings = {
        ...globalSettings,
        oauth2AccessToken: '',
        oauth2RefreshToken: '',
        oauth2TokenExpiry: '',
      }

      await this.settingsService.updateAppSettings(updatedGoogleSettings)

      return {
        success: true,
        message: 'Google 계정 연동이 해제되었습니다.',
      }
    } catch (error) {
      throw new Error(`로그아웃 실패: ${error.message}`)
    }
  }
}
