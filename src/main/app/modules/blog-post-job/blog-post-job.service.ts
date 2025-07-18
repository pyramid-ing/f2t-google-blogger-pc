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

@Injectable()
export class BlogPostJobService implements JobProcessor {
  private readonly logger = new Logger(BlogPostJobService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly publishService: PublishService,
    private readonly contentGenerateService: ContentGenerateService,
    private readonly jobLogsService: JobLogsService,
    private readonly storageService: StorageService,
  ) {}

  canProcess(job: any): boolean {
    return job.type === JobType.BLOG_POST
  }

  async process(jobId: string): Promise<JobResult> {
    const job = await this.prisma.job.findUniqueOrThrow({
      where: { id: jobId },
      include: {
        blogJob: true,
      },
    })

    if (!job.blogJob) {
      throw new CustomHttpException(ErrorCode.BLOG_POST_JOB_NOT_FOUND, { message: 'Blog post job data not found' })
    }

    let publishResult

    try {
      await this.createJobLog(jobId, 'info', '블로그 포스팅 작업 시작')

      // 1. 포스팅 내용 구체화
      await this.createJobLog(jobId, 'info', '본문 내용 생성')
      const blogHtml = await this.contentGenerateService.generate(job.blogJob.title, job.blogJob.content, jobId)

      // 2. 블로그 포스팅
      await this.createJobLog(jobId, 'info', '블로그 포스팅 시작')
      publishResult = await this.publishService.publishPost(job.blogJob.title, blogHtml, jobId)

      await this.createJobLog(jobId, 'info', '블로그 포스팅 완료')

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
    for (const row of rows) {
      const title = row.제목 || ''
      const content = row.내용 || ''
      const scheduledAtFormatStr = row.예약날짜 || ''
      let scheduledAt: Date

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
            create: { title, content },
          },
        },
        include: { blogJob: true },
      })

      await this.createJobLog(job.id, 'info', '작업이 등록되었습니다.')
      jobs.push(job)
    }
    return jobs
  }
}
