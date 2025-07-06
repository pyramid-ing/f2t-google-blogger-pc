import { GoogleBloggerError } from '@main/filters/error.types'
import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { firstValueFrom } from 'rxjs'
import { OauthService } from '../oauth/oauth.service'
import type * as BloggerTypes from './google-blogger.types'
import { SettingsService } from '@main/app/modules/settings/settings.service'

@Injectable()
export class GoogleBloggerService {
  private readonly logger = new Logger(GoogleBloggerService.name)
  private readonly bloggerApiUrl = 'https://www.googleapis.com/blogger/v3'

  constructor(
    private readonly httpService: HttpService,
    private readonly oauthService: OauthService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * 블로그 URL로 블로그 정보 조회
   */
  async getBlogByUrl(blogUrl: string, accessToken?: string): Promise<BloggerTypes.BloggerBlog> {
    try {
      const token = accessToken || (await this.oauthService.getAccessToken())
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

      if (error instanceof GoogleBloggerError) {
        throw error
      }

      if (error.response?.status === 401) {
        throw new GoogleBloggerError(
          'Google API 인증이 실패했습니다. 토큰을 확인해주세요.',
          'getBlogByUrl',
          undefined,
          undefined,
          {
            blogUrl,
            responseStatus: 401,
          },
        )
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
      const accessToken = await this.oauthService.getAccessToken()
      let finalBlogId = blogId
      if (!finalBlogId && blogUrl) {
        const blogInfo = await this.getBlogByUrl(blogUrl, accessToken)
        finalBlogId = blogInfo.id
      }
      if (!finalBlogId) {
        throw new GoogleBloggerError('blogId 또는 blogUrl이 필요합니다.', 'getBlogPosts', undefined, undefined, {
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

      if (error instanceof GoogleBloggerError) {
        throw error
      }

      if (error.response?.status === 401) {
        throw new GoogleBloggerError('Google API 인증이 실패했습니다.', 'getBlogPosts', blogId, blogUrl)
      } else if (error.response?.status === 404) {
        throw new GoogleBloggerError(
          `블로그를 찾을 수 없습니다: ${blogId || blogUrl}`,
          'getBlogPosts',
          blogId,
          blogUrl,
          { blogUrl, responseStatus: 404 },
        )
      }

      throw new GoogleBloggerError(
        `블로그 게시물 조회 실패: ${error.response?.data?.error?.message || error.message}`,
        'getBlogPosts',
        blogId,
        blogUrl,
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
      const accessToken = await this.oauthService.getAccessToken()
      const response = await firstValueFrom(
        this.httpService.get(`${this.bloggerApiUrl}/blogs/${blogId}/posts/${postId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      )
      this.logger.log(`게시물 조회 성공: ${blogId}/${postId}`)
      return response.data
    } catch (error) {
      this.logger.error(`게시물 조회 실패: ${blogId}/${postId}`, error)

      if (error instanceof GoogleBloggerError) {
        throw error
      }

      if (error.response?.status === 401) {
        throw new GoogleBloggerError('Google API 인증이 실패했습니다.', 'getBlogPost', blogId, postId)
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
      const accessToken = await this.oauthService.getAccessToken()
      const response = await firstValueFrom(
        this.httpService.get(`${this.bloggerApiUrl}/blogs/${blogId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
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
      const accessToken = await this.oauthService.getAccessToken()
      const response = await firstValueFrom(
        this.httpService.get(`${this.bloggerApiUrl}/users/self/blogs`, {
          headers: { Authorization: `Bearer ${accessToken}` },
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
    const settings = await this.settingsService.getSettings()
    const blogId = settings.bloggerBlogId
    if (!blogId) throw new Error('bloggerBlogId가 설정되어 있지 않습니다. 설정에서 블로그를 선택하세요.')
    try {
      const accessToken = await this.oauthService.getAccessToken()
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
      throw error
    }
  }
}
