import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { SettingsService } from '../../settings/settings.service'

const OAUTH2_CLIENT_ID = '365896770281-5jv37ff84orlj8i31arpnf9m6nbv54ch.apps.googleusercontent.com'

@Injectable()
export class GoogleBlogService {
  private readonly logger = new Logger(GoogleBlogService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Google 블로그 목록 조회
   */
  async getGoogleBlogList() {
    try {
      const blogs = await this.prisma.googleBlog.findMany({
        include: {
          oauth: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
      return blogs
    } catch (error: any) {
      this.logger.error('Google 블로그 목록 조회 실패:', error)
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `Google 블로그 목록 조회 실패: ${error.message}`,
        originalError: error.message,
      })
    }
  }

  /**
   * Google 블로그 생성 (OAuth 계정 ID를 받아서 해당 계정으로 블로그 생성)
   */
  async createGoogleBlog(data: {
    oauthAccountId: string
    bloggerBlogId: string
    bloggerBlogName: string
    name: string
    description?: string
    isDefault?: boolean
  }) {
    try {
      // OAuth 계정 조회
      const googleOAuth = await this.prisma.googleOAuth.findUnique({
        where: { id: data.oauthAccountId },
      })

      if (!googleOAuth) {
        throw new CustomHttpException(ErrorCode.GOOGLE_OAUTH_NOT_FOUND, {
          message: '지정된 OAuth 계정을 찾을 수 없습니다.',
          oauthId: data.oauthAccountId,
        })
      }

      // 블로그 이름 중복 확인
      const existingBlog = await this.prisma.googleBlog.findFirst({
        where: { name: data.name },
      })

      if (existingBlog) {
        throw new CustomHttpException(ErrorCode.GOOGLE_BLOG_NAME_DUPLICATE, {
          message: `블로그 이름 "${data.name}"이 이미 존재합니다.`,
          name: data.name,
        })
      }

      // 기본 블로그로 설정하는 경우, 기존 기본 블로그 해제
      if (data.isDefault) {
        await this.prisma.googleBlog.updateMany({
          where: {
            googleOauthId: googleOAuth.id,
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        })
      }

      // 기본 블로그가 없으면 이 블로그를 기본으로 설정
      const existingDefaultBlog = await this.prisma.googleBlog.findFirst({
        where: { isDefault: true },
      })

      const isDefault = data.isDefault || !existingDefaultBlog

      const googleBlog = await this.prisma.googleBlog.create({
        data: {
          googleOauthId: googleOAuth.id,
          bloggerBlogId: data.bloggerBlogId, // 실제 Blogger API의 블로그 ID
          bloggerBlogName: data.bloggerBlogName, // 실제 Blogger API의 블로그 ID
          name: data.name,
          description: data.description,
          isDefault,
        },
        include: {
          oauth: true,
        },
      })

      // 기본 블로그로 설정하는 경우, 기존 기본 블로그 해제
      if (isDefault && existingDefaultBlog) {
        await this.prisma.googleBlog.updateMany({
          where: {
            isDefault: true,
            id: { not: googleBlog.id },
          },
          data: {
            isDefault: false,
          },
        })
      }

      return googleBlog
    } catch (error: any) {
      if (error instanceof CustomHttpException) {
        throw error
      }

      // Prisma 제약 조건 에러 처리
      if (
        error.code === 'P2002' &&
        error.meta?.target &&
        Array.isArray(error.meta.target) &&
        error.meta.target.includes('googleOauthId') &&
        error.meta.target.includes('bloggerBlogId')
      ) {
        // OAuth 계정 정보를 다시 조회하여 에러 메시지에 포함
        const oauthAccount = await this.prisma.googleOAuth.findFirst({
          where: { oauth2ClientId: OAUTH2_CLIENT_ID },
        })

        throw new CustomHttpException(ErrorCode.GOOGLE_BLOG_OAUTH_BLOGGER_DUPLICATE, {
          message: '이미 등록된 Google 계정과 Blogger 블로그 조합입니다. 1개만 등록가능합니다.',
          oauthId: oauthAccount?.id || 'unknown',
          bloggerBlogId: data.bloggerBlogName,
        })
      }

      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `Google 블로그 생성 실패: ${error.message}`,
        originalError: error.message,
      })
    }
  }

  /**
   * Google 블로그 수정
   */
  async updateGoogleBlog(id: string, data: { name?: string; description?: string; isDefault?: boolean }) {
    try {
      // 기존 블로그 조회
      const existingBlog = await this.prisma.googleBlog.findUnique({
        where: { id },
        include: { oauth: true },
      })

      if (!existingBlog) {
        throw new CustomHttpException(ErrorCode.GOOGLE_BLOG_NOT_FOUND, {
          message: '수정할 블로그를 찾을 수 없습니다.',
          blogId: id,
        })
      }

      // 이름 변경 시 중복 확인
      if (data.name && data.name !== existingBlog.name) {
        const duplicateBlog = await this.prisma.googleBlog.findFirst({
          where: {
            name: data.name,
            id: { not: id }, // 현재 블로그 제외
          },
        })

        if (duplicateBlog) {
          throw new CustomHttpException(ErrorCode.GOOGLE_BLOG_NAME_DUPLICATE, {
            message: `블로그 이름 "${data.name}"이 이미 존재합니다.`,
            name: data.name,
          })
        }
      }

      // 기본 블로그로 설정하는 경우, 기존 기본 블로그 해제
      if (data.isDefault) {
        await this.prisma.googleBlog.updateMany({
          where: {
            googleOauthId: existingBlog.googleOauthId,
            isDefault: true,
            id: { not: id }, // 현재 블로그 제외
          },
          data: {
            isDefault: false,
          },
        })
      }

      const updatedBlog = await this.prisma.googleBlog.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          isDefault: data.isDefault,
        },
        include: {
          oauth: true,
        },
      })
      return updatedBlog
    } catch (error: any) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      this.logger.error('Google 블로그 수정 실패:', error)
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `Google 블로그 수정 실패: ${error.message}`,
        originalError: error.message,
      })
    }
  }

  /**
   * Google 블로그 삭제
   */
  async deleteGoogleBlog(id: string) {
    try {
      // 삭제할 블로그 조회
      const blogToDelete = await this.prisma.googleBlog.findUnique({
        where: { id },
        include: { oauth: true },
      })

      if (!blogToDelete) {
        throw new CustomHttpException(ErrorCode.GOOGLE_BLOG_NOT_FOUND, {
          message: '삭제할 블로그를 찾을 수 없습니다.',
          blogId: id,
        })
      }

      // 기본 블로그인지 확인
      if (blogToDelete.isDefault) {
        // 해당 OAuth 계정의 다른 블로그가 있는지 확인
        const otherBlogs = await this.prisma.googleBlog.findMany({
          where: {
            googleOauthId: blogToDelete.googleOauthId,
            id: { not: id },
          },
        })

        if (otherBlogs.length === 0) {
          throw new CustomHttpException(ErrorCode.GOOGLE_BLOG_NO_DEFAULT, {
            message: '기본 블로그는 삭제할 수 없습니다. 최소 1개의 블로그가 필요합니다.',
            blogId: id,
          })
        }

        // 다른 블로그 중 하나를 기본으로 설정
        await this.prisma.googleBlog.update({
          where: { id: otherBlogs[0].id },
          data: { isDefault: true },
        })
      }

      await this.prisma.googleBlog.delete({
        where: { id },
      })
      return { success: true }
    } catch (error: any) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      this.logger.error('Google 블로그 삭제 실패:', error)
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `Google 블로그 삭제 실패: ${error.message}`,
        originalError: error.message,
      })
    }
  }

  /**
   * Google 블로그 상세 조회
   */
  async getGoogleBlog(id: string) {
    try {
      const blog = await this.prisma.googleBlog.findUnique({
        where: { id },
        include: {
          oauth: true,
        },
      })
      if (!blog) {
        throw new CustomHttpException(ErrorCode.NOT_FOUND, {
          message: 'Google 블로그를 찾을 수 없습니다.',
          blogId: id,
        })
      }
      return blog
    } catch (error: any) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `Google 블로그 조회 실패: ${error.message}`,
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
        throw new CustomHttpException(ErrorCode.GOOGLE_BLOG_NO_DEFAULT, {
          message: '기본 블로그가 설정되어 있지 않습니다. 최소 1개의 기본 블로그가 필요합니다.',
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
   * 기본 블로그 보장 (최소 1개의 기본 블로그가 있도록 보장)
   */
  async ensureDefaultBlog() {
    try {
      // 기본 블로그가 있는지 확인
      const defaultBlog = await this.prisma.googleBlog.findFirst({
        where: { isDefault: true },
      })

      if (!defaultBlog) {
        // 기본 블로그가 없으면 첫 번째 블로그를 기본으로 설정
        const firstBlog = await this.prisma.googleBlog.findFirst({
          orderBy: { createdAt: 'asc' },
        })

        if (firstBlog) {
          await this.prisma.googleBlog.update({
            where: { id: firstBlog.id },
            data: { isDefault: true },
          })
          this.logger.log(`블로그 "${firstBlog.name}"을 기본 블로그로 자동 설정했습니다.`)
        }
      }
    } catch (error: any) {
      this.logger.error('기본 블로그 보장 중 오류 발생:', error)
    }
  }

  /**
   * 블로그 삭제 시 기본 블로그 보장
   */
  async deleteGoogleBlogWithDefaultProtection(id: string) {
    try {
      // 삭제할 블로그 조회
      const blogToDelete = await this.prisma.googleBlog.findUnique({
        where: { id },
        include: { oauth: true },
      })

      if (!blogToDelete) {
        throw new CustomHttpException(ErrorCode.GOOGLE_BLOG_NOT_FOUND, {
          message: '삭제할 블로그를 찾을 수 없습니다.',
          blogId: id,
        })
      }

      // 기본 블로그인지 확인
      if (blogToDelete.isDefault) {
        // 해당 OAuth 계정의 다른 블로그가 있는지 확인
        const otherBlogs = await this.prisma.googleBlog.findMany({
          where: {
            googleOauthId: blogToDelete.googleOauthId,
            id: { not: id },
          },
        })

        if (otherBlogs.length === 0) {
          throw new CustomHttpException(ErrorCode.GOOGLE_BLOG_NO_DEFAULT, {
            message: '기본 블로그는 삭제할 수 없습니다. 최소 1개의 블로그가 필요합니다.',
            blogId: id,
          })
        }

        // 다른 블로그 중 하나를 기본으로 설정
        await this.prisma.googleBlog.update({
          where: { id: otherBlogs[0].id },
          data: { isDefault: true },
        })
      }

      await this.prisma.googleBlog.delete({
        where: { id },
      })

      // 삭제 후 기본 블로그 보장
      await this.ensureDefaultBlog()

      return { success: true }
    } catch (error: any) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      this.logger.error('Google 블로그 삭제 실패:', error)
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `Google 블로그 삭제 실패: ${error.message}`,
        originalError: error.message,
      })
    }
  }
}
