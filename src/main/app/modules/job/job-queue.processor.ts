import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { BlogPostJobService } from '../blog-post-job/blog-post-job.service'
import { JobProcessor } from './job.processor.interface'
import { Cron, CronExpression } from '@nestjs/schedule'
import { JobStatus, JobType } from './job.types'
import { TopicJobService } from '@main/app/modules/topic/topic-job.service'
import { Job } from '@prisma/client'
import { JobLogsService } from '@main/app/modules/job-logs/job-logs.service'

@Injectable()
export class JobQueueProcessor implements OnModuleInit {
  private readonly logger = new Logger(JobQueueProcessor.name)
  private processors: Partial<Record<JobType, JobProcessor>>

  constructor(
    private readonly prisma: PrismaService,
    private readonly blogPostJobService: BlogPostJobService,
    private readonly topicJobService: TopicJobService,
    private readonly jobLogsService: JobLogsService,
  ) {}

  async onModuleInit() {
    this.processors = {
      [JobType.GENERATE_TOPIC]: this.topicJobService,
      [JobType.BLOG_POST]: this.blogPostJobService,
    }
    // 1. 시작 직후 processing 상태인 것들을 error 처리 (중간에 강제종료된 경우)
    await this.removeUnprocessedJobs()
  }

  private async removeUnprocessedJobs() {
    try {
      const processingJobs = await this.prisma.job.findMany({
        where: { status: JobStatus.PROCESSING },
      })
      for (const job of processingJobs) {
        await this.prisma.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.FAILED,
            errorMessage: '시스템 재시작으로 인한 작업 중단',
            completedAt: new Date(),
          },
        })
        await this.jobLogsService.createJobLog(job.id, '시스템 재시작으로 인한 작업 중단', 'error')
      }
      this.logger.log(`처리 중이던 ${processingJobs.length}개 작업을 실패 처리했습니다.`)
    } catch (error) {
      this.logger.error('처리 중이던 작업 정리 실패:', error)
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processNextJobs() {
    try {
      const pendingJobs = await this.prisma.job.findMany({
        where: {
          status: JobStatus.PENDING,
          scheduledAt: {
            lte: new Date(),
          },
        },
        orderBy: [{ priority: 'desc' }, { scheduledAt: 'asc' }],
      })

      for (const job of pendingJobs) {
        await this.processJob(job)
      }
    } catch (error) {
      this.logger.error('Error processing jobs:', error)
    }
  }

  public async processJob(job: Job) {
    const processor = this.processors[job.type as JobType]
    if (!processor || !processor.canProcess(job)) {
      this.logger.error(`No valid processor for job type ${job.type}`)
      await this.markJobAsFailed(job.id, `No valid processor for job type ${job.type}`)
      return
    }

    try {
      // 조건부 업데이트: PENDING 상태일 때만 PROCESSING으로 변경
      const updateResult = await this.prisma.job.updateMany({
        where: {
          id: job.id,
          status: JobStatus.PENDING, // 이 조건이 중복 처리를 방지합니다
        },
        data: {
          status: JobStatus.PROCESSING,
          startedAt: new Date(),
        },
      })

      // 다른 프로세스가 이미 처리 중인 경우 건너뛰기
      if (updateResult.count === 0) {
        this.logger.debug(`Job ${job.id} is already being processed by another instance`)
        return
      }

      this.logger.debug(`Starting job ${job.id} (${job.type})`)

      const result = await processor.process(job.id)

      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
          ...(result && {
            resultUrl: result.resultUrl,
            resultMsg: result.resultMsg,
          }),
        },
      })

      this.logger.debug(`Completed job ${job.id}`)
    } catch (error) {
      await this.markJobAsFailed(job.id, error.message)
      this.logger.error(`Error processing job ${job.id}:`, error)
    }
  }

  private async markJobAsFailed(jobId: string, errorMessage: string) {
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.FAILED,
        errorMessage,
        completedAt: new Date(),
      },
    })
  }
}
