import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { BlogPostJobService } from '../blog-post-job/blog-post-job.service'
import { JobProcessor } from './job.processor.interface'
import { Cron, CronExpression } from '@nestjs/schedule'
import { JobStatus, JobType } from './job.types'
import type { Job } from '@prisma/client'
import { TopicJobService } from '@main/app/modules/topic/topic-job.service'

@Injectable()
export class JobQueueProcessor {
  private readonly logger = new Logger(JobQueueProcessor.name)
  private readonly processors: Partial<Record<JobType, JobProcessor>>
  private isProcessing = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly blogPostJobService: BlogPostJobService,
    private readonly topicJobService: TopicJobService,
  ) {
    this.processors = {
      [JobType.GENERATE_TOPIC]: topicJobService,
      [JobType.BLOG_POST]: blogPostJobService,
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processNextJobs() {
    if (this.isProcessing) {
      this.logger.debug('Previous job processing is still running')
      return
    }

    try {
      this.isProcessing = true
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
    } finally {
      this.isProcessing = false
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
