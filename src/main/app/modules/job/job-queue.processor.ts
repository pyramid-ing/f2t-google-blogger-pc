import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { BlogPostJobService } from '../blog-post-job/blog-post-job.service'
import { JobProcessor } from './job.processor.interface'
import { Cron, CronExpression } from '@nestjs/schedule'
import { JobStatus, JobType } from './job.types'
import type { Job } from '@prisma/client'
import { TopicJobService } from '@main/app/modules/topic/topic-job.service'

@Injectable()
export class JobQueueProcessor implements OnModuleInit {
  private readonly logger = new Logger(JobQueueProcessor.name)
  private processors: Partial<Record<JobType, JobProcessor>>

  constructor(
    private readonly prisma: PrismaService,
    private readonly blogPostJobService: BlogPostJobService,
    private readonly topicJobService: TopicJobService,
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
      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.PROCESSING,
          startedAt: new Date(),
        },
      })

      await processor.process(job.id)

      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
        },
      })
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
