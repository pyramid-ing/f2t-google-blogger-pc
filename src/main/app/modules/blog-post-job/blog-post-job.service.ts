import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { JobProcessor } from '../job/job.processor.interface'
import { Job } from '@prisma/client'
import { PublishService } from '../publish/publish.service'
import { TopicService } from '../topic/topic.service'
import type { Prisma } from '@prisma/client'
import { BlogJobStatus, JobStatus, JobType } from '@main/app/modules/job/job.types'

type JobWithBlogJob = Prisma.JobGetPayload<{
  include: { blogJob: true }
}>

@Injectable()
export class BlogPostJobService implements JobProcessor {
  private readonly logger = new Logger(BlogPostJobService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly publishService: PublishService,
    private readonly topicService: TopicService,
  ) {}

  canProcess(job: Job): boolean {
    return job.type === JobType.BLOG_POST
  }

  async process(jobId: string): Promise<void> {
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
      // 1. 포스팅 목차 생성
      await this.createJobLog(jobId, 'info', '포스팅 목차 생성 시작')
      const blogOutline = await this.topicService.generateBlogOutline(job.blogJob.title, job.blogJob.content)
      await this.createJobLog(jobId, 'info', '포스팅 목차 생성 완료')

      // 2. 포스팅 내용 구체화
      await this.createJobLog(jobId, 'info', '포스팅 내용 구체화 시작')
      const detailedContent = await this.topicService.generatePostingContentsWithOpenAI(blogOutline)
      await this.createJobLog(jobId, 'info', '포스팅 내용 구체화 완료')

      // 3. 블로그 포스팅
      await this.createJobLog(jobId, 'info', '블로그 포스팅 시작')
      const result = await this.publishService.publishPost(job.blogJob.title, detailedContent.sections[0].html)

      // 4. 작업 완료 처리
      await this.prisma.job.update({
        where: { id: jobId },
        data: {
          resultUrl: result.url,
          resultMsg: '포스팅이 성공적으로 생성되었습니다.',
        },
      })

      await this.createJobLog(jobId, 'info', '블로그 포스팅 완료')
    } catch (error) {
      await this.createJobLog(jobId, 'error', `작업 실패: ${error.message}`)
      throw error
    }
  }

  private async createJobLog(jobId: string, level: string, message: string) {
    await this.prisma.jobLog.create({
      data: {
        jobId,
        level,
        message,
      },
    })
  }

  /**
   * 블로그 포스트 작업을 생성합니다.
   * @param rows [제목, 내용] 형태의 배열
   */
  async createBlogPostJobs(rows: [string, string][]) {
    const jobs = await Promise.all(
      rows.map(async ([title, content]) => {
        // 제목이 너무 길 경우 축약
        const shortTitle = title.length > 50 ? title.slice(0, 47) + '...' : title

        // 내용이 너무 길 경우 축약
        const shortContent = content.length > 100 ? content.slice(0, 97) + '...' : content

        const job = await this.prisma.job.create({
          data: {
            subject: `블로그 포스트: ${shortTitle}`, // Job 목록에서 보여질 제목
            desc: shortContent, // Job 상세에서 보여질 내용 미리보기
            type: JobType.BLOG_POST,
            status: JobStatus.PENDING,
            priority: 1,
            scheduledAt: new Date(), // 즉시 실행
            blogJob: {
              create: {
                title, // 원본 제목 전체
                content, // 원본 내용 전체
                status: BlogJobStatus.DRAFT,
              },
            },
          },
          include: {
            blogJob: true,
          },
        })

        // 작업 로그 생성
        await this.prisma.jobLog.create({
          data: {
            jobId: job.id,
            level: 'info',
            message: `블로그 포스트 작업이 등록되었습니다. (제목: ${shortTitle})`,
          },
        })

        return job
      }),
    )

    return jobs
  }
}
