import { Controller, Get, Post, Delete, Body, Query, Res, Logger, Param } from '@nestjs/common'
import { Response } from 'express'

import { GoogleOauthService } from './google-oauth.service'

@Controller('google-oauth')
export class GoogleOAuthController {
  private readonly logger = new Logger(GoogleOAuthController.name)

  constructor(private readonly oauthService: GoogleOauthService) {}

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
      await this.oauthService.processOAuthCallback(code)
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

      let errorMessage = error.message
      if (error.metadata && error.metadata.message) {
        errorMessage = error.metadata.message
      }

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
    return this.oauthService.processOAuthCallback(body.code)
  }

  @Post('refresh-token')
  async refreshToken() {
    return this.oauthService.refreshToken()
  }

  @Get('status')
  async getOAuthStatus() {
    return this.oauthService.getOAuthStatus()
  }

  @Post('logout')
  async logout() {
    return this.oauthService.logout()
  }

  @Post('validate-credentials')
  async validateCredentials(@Body() body: { clientId: string; clientSecret: string }) {
    return this.oauthService.validateClientCredentials(body.clientId, body.clientSecret)
  }

  @Get('accounts')
  async getOAuthAccounts() {
    return this.oauthService.getOAuthAccounts()
  }

  @Delete('accounts/:id')
  async deleteOAuthAccount(@Param('id') id: string) {
    return this.oauthService.deleteOAuthAccount(id)
  }
}
