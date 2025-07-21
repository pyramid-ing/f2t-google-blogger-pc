import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { PublishService } from '../publish/publish.service'
import { JobProcessor, JobResult, JobStatus, JobType } from '@main/app/modules/job/job.types'
import { ContentGenerateService } from '@main/app/modules/content-generate/content-generate.service'
import { JobLogsService } from '../job-logs/job-logs.service'
import { isValid, parse } from 'date-fns'
import { BlogPostExcelRow } from './blog-post-job.types'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { StorageService } from '@main/app/modules/google/storage/storage.service'
import { GoogleBlogService } from '../google/google-blog/google-blog.service'
import { TistoryService } from '../tistory/tistory.service'
import { SettingsService } from '../settings/settings.service'

// 게시 전략 인터페이스
interface PublishStrategy {
  publish(...args: any[]): Promise<{ success: boolean; message: string; url?: string }>
}

// 티스토리 게시 전략
class TistoryPublishStrategy implements PublishStrategy {
  constructor(private tistoryService: TistoryService) {}

  async publish(
    title: string,
    contentHtml: string,
    url: string,
    keywords: string[],
    category?: string,
    kakaoId?: string,
    kakaoPw?: string,
    postVisibility?: 'public' | 'private' | 'protected',
  ): Promise<{ success: boolean; message: string; url?: string }> {
    const options = {
      title,
      contentHtml,
      url,
      keywords,
      category,
      kakaoId,
      kakaoPw,
      postVisibility,
    }
    return await this.tistoryService.publish(options, true)
  }
}

// 구글 블로거 게시 전략
class GoogleBloggerPublishStrategy implements PublishStrategy {
  constructor(private publishService: PublishService) {}

  async publish(
    title: string,
    contentHtml: string,
    bloggerBlogId: string,
    oauthId: string,
    jobId?: string,
    labels?: string[],
  ): Promise<{ success: boolean; message: string; url?: string }> {
    return await this.publishService.publish(title, contentHtml, bloggerBlogId, oauthId, jobId, labels)
  }
}

@Injectable()
export class BlogPostJobService implements JobProcessor {
  private readonly logger = new Logger(BlogPostJobService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly publishService: PublishService,
    private readonly contentGenerateService: ContentGenerateService,
    private readonly jobLogsService: JobLogsService,
    private readonly storageService: StorageService,
    private readonly googleBlogService: GoogleBlogService,
    private readonly tistoryService: TistoryService,
    private readonly settingsService: SettingsService,
  ) {}

  canProcess(job: any): boolean {
    return job.type === JobType.BLOG_POST
  }

  async process(jobId: string): Promise<JobResult> {
    const job = await this.prisma.job.findUniqueOrThrow({
      where: { id: jobId },
      include: {
        blogJob: {
          include: {
            googleBlog: {
              include: {
                oauth: true,
              },
            },
          },
        },
      },
    })

    if (!job.blogJob) {
      throw new CustomHttpException(ErrorCode.BLOG_POST_JOB_NOT_FOUND, { message: 'Blog post job data not found' })
    }

    // blogName을 통해 GoogleBlog 찾기
    let targetGoogleBlog = job.blogJob.googleBlog
    if (!targetGoogleBlog && job.blogJob.blogName) {
      // blogName으로 GoogleBlog 찾기
      targetGoogleBlog = await this.prisma.googleBlog.findUnique({
        where: { name: job.blogJob.blogName },
        include: {
          oauth: true,
        },
      })
    }

    // 여전히 없으면 기본 블로그 사용
    if (!targetGoogleBlog) {
      this.logger.log('작업에 연결된 Google 블로그가 없어 기본 블로그를 사용합니다.')
      targetGoogleBlog = await this.googleBlogService.getDefaultGoogleBlog()

      if (!targetGoogleBlog) {
        throw new CustomHttpException(ErrorCode.BLOGGER_DEFAULT_NOT_SET, {
          message: '기본 블로거가 설정되지 않았습니다. 설정에서 기본 블로거를 먼저 설정해주세요.',
        })
      }
    }

    let publishResult

    try {
      await this.createJobLog(jobId, 'info', '블로그 포스팅 작업 시작')

      // 1. 포스팅 내용 구체화
      await this.createJobLog(jobId, 'info', '본문 내용 생성')
      const blogHtml = await this.contentGenerateService.generate(job.blogJob.title, job.blogJob.content, jobId)

      // 2. 라벨 처리
      const labels = job.blogJob.labels ? (job.blogJob.labels as string[]) : undefined
      if (labels && labels.length > 0) {
        await this.createJobLog(jobId, 'info', `라벨 설정: ${labels.join(', ')}`)
      }

      // 3. 게시 전략 선택
      const settings = await this.settingsService.getSettings()
      let publishStrategy: PublishStrategy
      if (settings.publishType === 'tistory') {
        publishStrategy = new TistoryPublishStrategy(this.tistoryService)
      } else {
        publishStrategy = new GoogleBloggerPublishStrategy(this.publishService)
      }

      // 4. 블로그 포스팅
      await this.createJobLog(jobId, 'info', `블로그 발행 시작 (대상: ${settings.publishType})`)

      switch (settings.publishType) {
        case 'google':
          publishResult = await publishStrategy.publish(
            job.blogJob.title,
            blogHtml,
            targetGoogleBlog.bloggerBlogId,
            targetGoogleBlog.oauth.id,
            jobId,
            labels,
          )
          break
        case 'tistory':
          publishResult = await publishStrategy.publish(
            job.blogJob.title,
            blogHtml,
            'https://moneys2b.tistory.com/manage/newpost', // url - 기본값
            [], // keywords - 기본값
            undefined, // category
            'busidev22@gmail.com', // kakaoId
            'tkfkdgo1', // kakaoPw
            'private', // postVisibility
          )
          break
      }

      await this.createJobLog(jobId, 'info', '블로그 발행 완료')

      return {
        resultUrl: publishResult?.url,
        resultMsg: '포스팅이 성공적으로 생성되었습니다.',
      }
    } catch (e) {
      // === 에러 발생 시 jobId로 GCS 객체 전체 삭제 ===
      if (jobId) {
        try {
          await this.storageService.deleteFilesByPrefix(jobId)
          await this.createJobLog(jobId, 'info', `에러 발생으로 GCS 내 이미지 모두 삭제 완료`)
          this.logger.log(`에러 발생으로 GCS 내 ${jobId}/ 객체 모두 삭제 완료`)
        } catch (removeErr) {
          await this.createJobLog(jobId, 'error', `GCS ${jobId}/ 객체 삭제 실패:`)
          this.logger.error(`GCS ${jobId}/ 객체 삭제 실패:`, removeErr)
        }
      }
      throw e
    }
  }

  private async createJobLog(jobId: string, level: string, message: string) {
    await this.jobLogsService.createJobLog(jobId, message, level as any)
  }

  /**
   * 엑셀 row 배열로부터 여러 개의 블로그 포스트 job을 생성
   */
  async createJobsFromExcelRows(rows: BlogPostExcelRow[]): Promise<any[]> {
    const jobs: any[] = []

    // 기본 블로거 설정 조회
    const defaultBlog = await this.googleBlogService.getDefaultGoogleBlog()
    if (!defaultBlog) {
      throw new CustomHttpException(ErrorCode.BLOGGER_DEFAULT_NOT_SET, {
        message: '기본 블로거가 설정되지 않았습니다. 설정에서 기본 블로거를 먼저 설정해주세요.',
      })
    }

    for (const row of rows) {
      const title = row.제목 || ''
      const content = row.내용 || ''
      const labels = row.라벨
        ? row.라벨
            .split(',')
            .map(label => label.trim())
            .filter(label => label)
        : []
      const scheduledAtFormatStr = row.예약날짜 || ''
      let scheduledAt: Date

      // 블로거 이름 처리
      let bloggerBlogName = row.블로그이름 || defaultBlog.name
      let targetBlog = defaultBlog

      // 블로거 이름 유효성 검사
      if (bloggerBlogName) {
        // 해당 블로거가 존재하는지 확인
        const blogExists = await this.prisma.googleBlog.findFirst({
          where: {
            name: bloggerBlogName,
          },
          include: {
            oauth: true,
          },
        })

        if (!blogExists) {
          throw new CustomHttpException(ErrorCode.BLOGGER_ID_NOT_FOUND, {
            message: `블로거 이름 "${bloggerBlogName}"가 존재하지 않습니다. 설정에서 올바른 블로거를 선택해주세요.`,
            invalidBloggerId: bloggerBlogName,
          })
        }
        targetBlog = blogExists
      }

      if (scheduledAtFormatStr && typeof scheduledAtFormatStr === 'string' && scheduledAtFormatStr.trim() !== '') {
        try {
          // 날짜 문자열에서 불필요한 공백 제거
          const cleanDateStr = scheduledAtFormatStr.trim()

          // date-fns의 parse 함수를 사용하여 날짜 파싱
          const parsed = parse(cleanDateStr, 'yyyy-MM-dd HH:mm', new Date())

          if (isValid(parsed)) {
            scheduledAt = parsed
            this.logger.log(`날짜 파싱 성공: ${cleanDateStr} → ${parsed.toISOString()}`)
          } else {
            this.logger.warn(`유효하지 않은 날짜 형식: ${cleanDateStr}, 현재 시간으로 설정됩니다.`)
            scheduledAt = new Date()
          }
        } catch (error) {
          this.logger.error(`날짜 파싱 오류: ${scheduledAtFormatStr}, ${error.message}`)
          scheduledAt = new Date()
        }
      } else {
        this.logger.warn('예약날짜가 비어있어 현재 시간으로 설정됩니다.')
        scheduledAt = new Date()
      }

      const job = await this.prisma.job.create({
        data: {
          subject: `${title} 제목 포스팅 등록`,
          desc: `${content}`,
          type: JobType.BLOG_POST,
          status: JobStatus.PENDING,
          priority: 1,
          scheduledAt,
          blogJob: {
            create: {
              title,
              content,
              labels: labels.length > 0 ? labels : null,
              blogName: targetBlog.name,
            },
          },
        },
        include: { blogJob: true },
      })

      await this.createJobLog(
        job.id,
        'info',
        `작업이 등록되었습니다. (블로거 이름: ${targetBlog.name}, ID: ${targetBlog.bloggerBlogId})`,
      )
      jobs.push(job)
    }
    return jobs
  }
}
