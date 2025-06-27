import { GoogleAuthError, GoogleBloggerError, GoogleConfigError, GoogleTokenError } from '@main/filters/error.types'
import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { firstValueFrom } from 'rxjs'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import type * as BloggerTypes from './google-blogger.types'

@Injectable()
export class GoogleBloggerService {
  private readonly logger = new Logger(GoogleBloggerService.name)
  private readonly bloggerApiUrl = 'https://www.googleapis.com/blogger/v3'

  constructor(
    private readonly httpService: HttpService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * 저장된 Google OAuth 토큰 가져오기
   */
  private async getAccessToken(): Promise<string> {
    try {
      const globalSettings = await this.settingsService.getAppSettings()

      const { oauth2AccessToken, oauth2RefreshToken, oauth2TokenExpiry, oauth2ClientId, oauth2ClientSecret } =
        globalSettings

      if (!oauth2AccessToken) {
        throw new GoogleAuthError('Google OAuth 토큰이 없습니다. 먼저 로그인해주세요.', 'getAccessToken', {
          hasRefreshToken: !!oauth2RefreshToken,
        })
      }

      // 토큰 만료 확인
      const expiryTime = oauth2TokenExpiry ? new Date(oauth2TokenExpiry).getTime() : 0
      const isExpired = Date.now() >= expiryTime - 60000 // 1분 여유

      if (isExpired && oauth2RefreshToken) {
        // 토큰 자동 갱신
        this.logger.log('Google 토큰 만료 감지, 자동 갱신 시도...')
        try {
          const newTokens = await this.refreshAccessToken(oauth2RefreshToken, oauth2ClientId, oauth2ClientSecret)

          // DB에 새로운 토큰 저장
          const updatedGlobalSetting = {
            ...globalSettings,
            oauth2AccessToken: newTokens.accessToken,
            oauth2TokenExpiry: new Date(newTokens.expiresAt).toISOString(),
          }

          await this.settingsService.updateAppSettings(updatedGlobalSetting)
          this.logger.log('Google 토큰이 자동으로 갱신되었습니다.')

          return newTokens.accessToken
        } catch (refreshError) {
          throw new GoogleTokenError(
            `Google 토큰 갱신 실패: ${refreshError.message}. 다시 로그인해주세요.`,
            'refreshAccessToken',
            true,
            { originalError: refreshError.message },
          )
        }
      }

      return oauth2AccessToken
    } catch (error) {
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
  private async refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
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
    } catch (error) {
      if (error instanceof GoogleTokenError) {
        throw error
      }
      throw new GoogleTokenError(`토큰 갱신 중 네트워크 오류: ${error.message}`, 'refreshAccessToken', false, {
        originalError: error.message,
      })
    }
  }

  /**
   * 블로그 URL로 블로그 정보 조회
   */
  async getBlogByUrl(blogUrl: string, accessToken?: string): Promise<BloggerTypes.BloggerBlog> {
    try {
      const token = accessToken || (await this.getAccessToken())

      const response = await firstValueFrom(
        this.httpService.get(`${this.bloggerApiUrl}/blogs/byurl`, {
          params: {
            url: blogUrl,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      )

      this.logger.log(`블로그 정보 조회 성공: ${blogUrl}`)
      return response.data
    } catch (error) {
      this.logger.error(`블로그 정보 조회 실패: ${blogUrl}`, error)

      if (error instanceof GoogleAuthError || error instanceof GoogleTokenError) {
        throw error
      }

      if (error.response?.status === 401) {
        throw new GoogleAuthError('Google API 인증이 실패했습니다. 토큰을 확인해주세요.', 'getBlogByUrl', {
          blogUrl,
          responseStatus: 401,
        })
      } else if (error.response?.status === 404) {
        throw new GoogleBloggerError(`블로그를 찾을 수 없습니다: ${blogUrl}`, 'getBlogByUrl', undefined, undefined, {
          blogUrl,
          responseStatus: 404,
        })
      }

      throw new GoogleBloggerError(
        `블로그 정보 조회 실패: ${error.response?.data?.error?.message || error.message}`,
        'getBlogByUrl',
        undefined,
        undefined,
        {
          blogUrl,
          responseStatus: error.response?.status,
          responseData: error.response?.data,
        },
      )
    }
  }

  /**
   * 블로그 게시물 목록 조회
   */
  async getBlogPosts(options: BloggerTypes.BloggerOptions): Promise<BloggerTypes.BloggerPostListResponse> {
    const { blogId, blogUrl, maxResults = 10, pageToken, status = 'live' } = options

    try {
      const accessToken = await this.getAccessToken()
      let finalBlogId = blogId

      // blogId가 없으면 blogUrl로 조회
      if (!finalBlogId && blogUrl) {
        const blogInfo = await this.getBlogByUrl(blogUrl, accessToken)
        finalBlogId = blogInfo.id
      }

      if (!finalBlogId) {
        throw new GoogleBloggerError('blogId 또는 blogUrl이 필요합니다.', 'getBlogPosts', undefined, undefined, {
          providedOptions: options,
        })
      }

      const params: any = {
        maxResults,
        status,
      }

      if (pageToken) {
        params.pageToken = pageToken
      }

      const response = await firstValueFrom(
        this.httpService.get(`${this.bloggerApiUrl}/blogs/${finalBlogId}/posts`, {
          params,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      )

      this.logger.log(`블로그 게시물 조회 성공: ${finalBlogId} (${response.data.items?.length || 0}개)`)
      return response.data
    } catch (error) {
      this.logger.error(`블로그 게시물 조회 실패: ${blogId || blogUrl}`, error)

      if (
        error instanceof GoogleAuthError ||
        error instanceof GoogleTokenError ||
        error instanceof GoogleBloggerError
      ) {
        throw error
      }

      if (error.response?.status === 401) {
        throw new GoogleAuthError('Google API 인증이 실패했습니다.', 'getBlogPosts', { blogId, blogUrl })
      } else if (error.response?.status === 404) {
        throw new GoogleBloggerError(
          `블로그를 찾을 수 없습니다: ${blogId || blogUrl}`,
          'getBlogPosts',
          blogId,
          undefined,
          { blogUrl, responseStatus: 404 },
        )
      }

      throw new GoogleBloggerError(
        `블로그 게시물 조회 실패: ${error.response?.data?.error?.message || error.message}`,
        'getBlogPosts',
        blogId,
        undefined,
        {
          blogUrl,
          responseStatus: error.response?.status,
          responseData: error.response?.data,
          requestOptions: options,
        },
      )
    }
  }

  /**
   * 특정 게시물 조회
   */
  async getBlogPost(blogId: string, postId: string): Promise<BloggerTypes.BloggerPost> {
    try {
      const accessToken = await this.getAccessToken()

      const response = await firstValueFrom(
        this.httpService.get(`${this.bloggerApiUrl}/blogs/${blogId}/posts/${postId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      )

      this.logger.log(`게시물 조회 성공: ${blogId}/${postId}`)
      return response.data
    } catch (error) {
      this.logger.error(`게시물 조회 실패: ${blogId}/${postId}`, error)

      if (error instanceof GoogleAuthError || error instanceof GoogleTokenError) {
        throw error
      }

      if (error.response?.status === 401) {
        throw new GoogleAuthError('Google API 인증이 실패했습니다.', 'getBlogPost', { blogId, postId })
      } else if (error.response?.status === 404) {
        throw new GoogleBloggerError(`게시물을 찾을 수 없습니다: ${postId}`, 'getBlogPost', blogId, postId, {
          responseStatus: 404,
        })
      }

      throw new GoogleBloggerError(
        `게시물 조회 실패: ${error.response?.data?.error?.message || error.message}`,
        'getBlogPost',
        blogId,
        postId,
        {
          responseStatus: error.response?.status,
          responseData: error.response?.data,
        },
      )
    }
  }

  /**
   * 블로그 정보 조회
   */
  async getBlogInfo(blogId: string): Promise<BloggerTypes.BloggerBlog> {
    try {
      const accessToken = await this.getAccessToken()

      const response = await firstValueFrom(
        this.httpService.get(`${this.bloggerApiUrl}/blogs/${blogId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      )
      return response.data
    } catch (error) {
      throw new Error(`블로그 정보 조회 실패: ${error.response?.data?.error?.message || error.message}`)
    }
  }

  /**
   * 사용자의 블로그 목록 조회
   */
  async getUserSelfBlogs(): Promise<BloggerTypes.BloggerBlogListResponse> {
    try {
      const accessToken = await this.getAccessToken()

      const response = await firstValueFrom(
        this.httpService.get(`${this.bloggerApiUrl}/users/self/blogs`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      )
      return response.data
    } catch (error) {
      throw new Error(`사용자 블로그 목록 조회 실패: ${error.response?.data?.error?.message || error.message}`)
    }
  }

  /**
   * Blogger API를 사용하여 블로그에 포스팅
   */
  async postToBlogger(request: Omit<BloggerTypes.BloggerPostRequest, 'blogId'>): Promise<BloggerTypes.BloggerPost> {
    const { title, content, labels } = request
    const settings = await this.settingsService.getAppSettings()
    const blogId = settings.bloggerBlogId
    if (!blogId) throw new Error('bloggerBlogId가 설정되어 있지 않습니다. 설정에서 블로그를 선택하세요.')
    try {
      const accessToken = await this.getAccessToken()
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.bloggerApiUrl}/blogs/${blogId}/posts/`,
          {
            kind: 'blogger#post',
            title,
            content,
            ...(labels ? { labels } : {}),
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      )
      this.logger.log(`Blogger에 포스팅 성공: ${response.data.id}`)
      return response.data
    } catch (error) {
      this.logger.error('Blogger 포스팅 실패:', error)
      if (error.response?.status === 401) {
        throw new GoogleAuthError('Google API 인증이 실패했습니다.', 'postToBlogger', { blogId, title })
      }
      throw new GoogleBloggerError(
        `Blogger 포스팅 실패: ${error.response?.data?.error?.message || error.message}`,
        'postToBlogger',
        blogId,
        undefined,
        {
          responseStatus: error.response?.status,
          responseData: error.response?.data,
        },
      )
    }
  }
}
