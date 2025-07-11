import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { JobProcessor, JobResult } from '../job/job.processor.interface'
import { PublishService } from '../publish/publish.service'
import { JobStatus, JobType } from '@main/app/modules/job/job.types'
import { ContentGenerateService } from '@main/app/modules/content-generate/content-generate.service'
import { JobLogsService } from '../job-logs/job-logs.service'
import { isValid, parse } from 'date-fns'
import { BlogPostExcelRow } from './blog-post-job.types'

@Injectable()
export class BlogPostJobService implements JobProcessor {
  private readonly logger = new Logger(BlogPostJobService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly publishService: PublishService,
    private readonly contentGenerateService: ContentGenerateService,
    private readonly jobLogsService: JobLogsService,
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
      throw new Error('Blog post job data not found')
    }

    await this.createJobLog(jobId, 'info', '블로그 포스팅 작업 시작')

    try {
      // 1. 포스팅 내용 구체화
      await this.createJobLog(jobId, 'info', '본문 내용 생성')
      const blogHtml = await this.contentGenerateService.generate(job.blogJob.title, job.blogJob.content, jobId)

      // 2. 블로그 포스팅
      await this.createJobLog(jobId, 'info', '블로그 포스팅 시작')
      const result = await this.publishService.publishPost(job.blogJob.title, blogHtml, jobId)

      await this.createJobLog(jobId, 'info', '블로그 포스팅 완료')

      return {
        resultUrl: result.url,
        resultMsg: '포스팅이 성공적으로 생성되었습니다.',
      }
    } catch (error) {
      await this.createJobLog(jobId, 'error', `작업 실패: ${error.message}`)
      throw error
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
