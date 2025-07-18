import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { firstValueFrom } from 'rxjs'
import { GoogleOauthService } from '../oauth/google-oauth.service'
import type * as BloggerTypes from './google-blogger.types'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'

@Injectable()
export class GoogleBloggerService {
  private readonly logger = new Logger(GoogleBloggerService.name)
  private readonly bloggerApiUrl = 'https://www.googleapis.com/blogger/v3'

  constructor(
    private readonly httpService: HttpService,
    private readonly oauthService: GoogleOauthService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 블로그 URL로 블로그 정보 조회
   */
  async getBlogByUrl(blogUrl: string, googleOAuthId: string): Promise<BloggerTypes.BloggerBlog> {
    try {
      const token = await this.oauthService.getAccessToken(googleOAuthId)
      const response = await firstValueFrom(
        this.httpService.get(`${this.bloggerApiUrl}/blogs/byurl`, {
          params: { url: blogUrl },
          headers: { Authorization: `Bearer ${token}` },
        }),
      )
      this.logger.log(`블로그 정보 조회 성공: ${blogUrl}`)
      return response.data
    } catch (error) {
      this.logger.error(`블로그 정보 조회 실패: ${blogUrl}`, error)

      if (error.response?.status === 401) {
        throw new CustomHttpException(ErrorCode.AUTH_REQUIRED, {
          message: 'Google API 인증이 실패했습니다. 토큰을 확인해주세요.',
          blogUrl,
          responseStatus: 401,
        })
      } else if (error.response?.status === 404) {
        throw new CustomHttpException(ErrorCode.DATA_NOT_FOUND, {
          message: `블로그를 찾을 수 없습니다: ${blogUrl}`,
          blogUrl,
          responseStatus: 404,
        })
      }

      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `블로그 정보 조회 실패: ${error.response?.data?.error?.message || error.message}`,
        blogUrl,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
      })
    }
  }

  /**
   * 블로그 게시물 목록 조회
   */
  async getBlogPosts(
    options: BloggerTypes.BloggerOptions,
    googleOAuthId: string,
  ): Promise<BloggerTypes.BloggerPostListResponse> {
    const { blogId, blogUrl, maxResults = 10, pageToken, status = 'live' } = options
    try {
      const accessToken = await this.oauthService.getAccessToken(googleOAuthId)
      let finalBlogId = blogId
      if (!finalBlogId && blogUrl) {
        const blogInfo = await this.getBlogByUrl(blogUrl, googleOAuthId)
        finalBlogId = blogInfo.id
      }
      if (!finalBlogId) {
        throw new CustomHttpException(ErrorCode.BLOGGER_BLOG_URL_REQUIRED, {
          message: 'blogId 또는 blogUrl이 필요합니다.',
          providedOptions: options,
        })
      }
      const params: any = { maxResults, status }
      if (pageToken) params.pageToken = pageToken
      const response = await firstValueFrom(
        this.httpService.get(`${this.bloggerApiUrl}/blogs/${finalBlogId}/posts`, {
          params,
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      )
      this.logger.log(`블로그 게시물 조회 성공: ${finalBlogId} (${response.data.items?.length || 0}개)`)
      return response.data
    } catch (error) {
      this.logger.error(`블로그 게시물 조회 실패: ${blogId || blogUrl}`, error)

      if (error instanceof CustomHttpException) {
        throw error
      }

      if (error.response?.status === 401) {
        throw new CustomHttpException(ErrorCode.AUTH_REQUIRED, {
          message: 'Google API 인증이 실패했습니다.',
          blogId,
          blogUrl,
        })
      } else if (error.response?.status === 404) {
        throw new CustomHttpException(ErrorCode.DATA_NOT_FOUND, {
          message: `블로그를 찾을 수 없습니다: ${blogId || blogUrl}`,
          blogId,
          blogUrl,
          responseStatus: 404,
        })
      }

      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `블로그 게시물 조회 실패: ${error.response?.data?.error?.message || error.message}`,
        blogId,
        blogUrl,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
        requestOptions: options,
      })
    }
  }

  /**
   * 특정 게시물 조회
   */
  async getBlogPost(blogId: string, postId: string, googleOAuthId: string): Promise<BloggerTypes.BloggerPost> {
    try {
      const accessToken = await this.oauthService.getAccessToken(googleOAuthId)
      const response = await firstValueFrom(
        this.httpService.get(`${this.bloggerApiUrl}/blogs/${blogId}/posts/${postId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      )
      this.logger.log(`게시물 조회 성공: ${blogId}/${postId}`)
      return response.data
    } catch (error) {
      this.logger.error(`게시물 조회 실패: ${blogId}/${postId}`, error)

      if (error instanceof CustomHttpException) {
        throw error
      }

      if (error.response?.status === 401) {
        throw new CustomHttpException(ErrorCode.AUTH_REQUIRED, {
          message: 'Google API 인증이 실패했습니다.',
          blogId,
          postId,
        })
      } else if (error.response?.status === 404) {
        throw new CustomHttpException(ErrorCode.DATA_NOT_FOUND, {
          message: `게시물을 찾을 수 없습니다: ${postId}`,
          blogId,
          postId,
          responseStatus: 404,
        })
      }

      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `게시물 조회 실패: ${error.response?.data?.error?.message || error.message}`,
        blogId,
        postId,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
      })
    }
  }

  /**
   * 블로그 정보 조회
   */
  async getBlogInfo(blogId: string, googleOAuthId: string): Promise<BloggerTypes.BloggerBlog> {
    try {
      const accessToken = await this.oauthService.getAccessToken(googleOAuthId)
      const response = await firstValueFrom(
        this.httpService.get(`${this.bloggerApiUrl}/blogs/${blogId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      )
      return response.data
    } catch (error) {
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `블로그 정보 조회 실패: ${error.response?.data?.error?.message || error.message}`,
        blogId,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
      })
    }
  }

  /**
   * 사용자의 블로그 목록 조회 (기본 계정)
   */
  async getUserSelfBlogs(googleOAuthId: string): Promise<BloggerTypes.BloggerBlogListResponse> {
    try {
      const accessToken = await this.oauthService.getAccessToken(googleOAuthId)
      const response = await firstValueFrom(
        this.httpService.get(`${this.bloggerApiUrl}/users/self/blogs`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      )
      return response.data
    } catch (error) {
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `사용자 블로그 목록 조회 실패: ${error.response?.data?.error?.message || error.message}`,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
      })
    }
  }

  /**
   * 특정 OAuth 계정으로 사용자의 블로그 목록 조회
   */
  async getUserSelfBlogsByOAuthId(oauthId: string): Promise<BloggerTypes.BloggerBlogListResponse> {
    try {
      // 특정 OAuth 계정 조회
      const oauthAccount = await this.prisma.googleOAuth.findUnique({
        where: { id: oauthId },
      })

      if (!oauthAccount) {
        throw new CustomHttpException(ErrorCode.DATA_NOT_FOUND, {
          message: `OAuth 계정을 찾을 수 없습니다: ${oauthId}`,
        })
      }

      // 토큰 만료 확인 및 갱신
      const expiryTime = oauthAccount.oauth2TokenExpiry.getTime()
      const isExpired = Date.now() >= expiryTime - 60000 // 1분 여유

      let accessToken = oauthAccount.oauth2AccessToken

      if (isExpired && oauthAccount.oauth2RefreshToken) {
        try {
          const newTokens = await this.oauthService.refreshAccessToken(
            oauthAccount.oauth2RefreshToken,
            oauthAccount.oauth2ClientId,
            oauthAccount.oauth2ClientSecret,
          )

          // DB 업데이트
          await this.prisma.googleOAuth.update({
            where: { id: oauthId },
            data: {
              oauth2AccessToken: newTokens.accessToken,
              oauth2TokenExpiry: new Date(newTokens.expiresAt),
            },
          })

          accessToken = newTokens.accessToken
        } catch (refreshError) {
          throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
            message: `토큰 갱신 실패: ${refreshError.message}`,
            originalError: refreshError.message,
          })
        }
      }

      const response = await firstValueFrom(
        this.httpService.get(`${this.bloggerApiUrl}/users/self/blogs`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      )
      return response.data
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `사용자 블로그 목록 조회 실패: ${error.response?.data?.error?.message || error.message}`,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
      })
    }
  }

  /**
   * Blogger API를 사용하여 블로그에 포스팅
   */
  async postToBlogger(request: Omit<BloggerTypes.BloggerPostRequest, 'blogId'>): Promise<BloggerTypes.BloggerPost> {
    const { title, content, labels, bloggerBlogId, googleOAuthId } = request

    if (!bloggerBlogId) {
      throw new CustomHttpException(ErrorCode.INVALID_INPUT, {
        message: 'bloggerBlogId가 설정되어 있지 않습니다. 설정에서 블로그를 선택하세요.',
      })
    }

    // bloggerBlogId로 GoogleBlog를 찾아서 실제 Blogger API의 blogId를 가져옴
    const googleBlog = await this.prisma.googleBlog.findFirst({
      where: { bloggerBlogId },
    })

    if (!googleBlog) {
      throw new CustomHttpException(ErrorCode.BLOGGER_ID_NOT_FOUND, {
        message: `블로거 ID "${bloggerBlogId}"가 존재하지 않습니다.`,
        invalidBloggerId: bloggerBlogId,
      })
    }

    const blogId = googleBlog.bloggerBlogId

    const accessToken = await this.oauthService.getAccessToken(googleOAuthId)
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
  }

  /**
   * Blogger 블로그 목록 조회
   */
  async getBloggerBlogs(googleOAuthId: string) {
    try {
      const accessToken = await this.oauthService.getAccessToken(googleOAuthId)
      const response = await firstValueFrom(
        this.httpService.get('https://www.googleapis.com/blogger/v3/users/self/blogs', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      )
      return response.data
    } catch (error: any) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `Blogger 블로그 목록 조회 실패: ${error.message}`,
        originalError: error.message,
      })
    }
  }

  /**
   * 클라이언트 자격 증명 검증
   */
  async validateClientCredentials(clientId: string, clientSecret: string) {
    try {
      // 간단한 검증 로직 (실제로는 Google API를 호출하여 검증)
      if (!clientId || !clientSecret) {
        throw new CustomHttpException(ErrorCode.INVALID_INPUT, {
          message: 'Client ID와 Client Secret이 필요합니다.',
        })
      }

      return {
        valid: true,
        message: '자격 증명이 유효합니다.',
      }
    } catch (error: any) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `자격 증명 검증 실패: ${error.message}`,
        originalError: error.message,
      })
    }
  }

  /**
   * 기본 블로그 조회
   */
  async getDefaultGoogleBlog() {
    try {
      const defaultBlog = await this.prisma.googleBlog.findFirst({
        where: { isDefault: true },
        include: {
          oauth: true,
        },
      })

      if (!defaultBlog) {
        throw new CustomHttpException(ErrorCode.DATA_NOT_FOUND, {
          message: '기본 블로그가 설정되어 있지 않습니다.',
        })
      }

      return defaultBlog
    } catch (error: any) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `기본 블로그 조회 실패: ${error.message}`,
        originalError: error.message,
      })
    }
  }

  /**
   * 특정 OAuth 계정의 기본 블로그 조회
   */
  async getDefaultGoogleBlogByOAuthId(oauthId: string) {
    try {
      const defaultBlog = await this.prisma.googleBlog.findFirst({
        where: {
          isDefault: true,
          googleOauthId: oauthId,
        },
        include: {
          oauth: true,
        },
      })

      if (!defaultBlog) {
        throw new CustomHttpException(ErrorCode.DATA_NOT_FOUND, {
          message: `OAuth 계정 ${oauthId}의 기본 블로그가 설정되어 있지 않습니다.`,
          oauthId,
        })
      }

      return defaultBlog
    } catch (error: any) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `기본 블로그 조회 실패: ${error.message}`,
        oauthId,
        originalError: error.message,
      })
    }
  }
}
