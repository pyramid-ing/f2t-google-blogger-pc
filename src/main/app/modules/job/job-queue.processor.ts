import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { JobProcessor } from './job.processor.interface'
import { Job, JobStatus, JobType } from '@prisma/client'
import { BlogPostJobService } from '../blog-post-job/blog-post-job.service'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'

@Injectable()
export class JobQueueProcessor implements OnModuleInit {
  private readonly logger = new Logger(JobQueueProcessor.name)
  private readonly processors: Record<JobType, JobProcessor>
  private isProcessing = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly blogPostJobService: BlogPostJobService,
  ) {
    this.processors = {
      [JobType.BLOG_POST]: blogPostJobService,
    }
  }

  onModuleInit() {
    this.startJobPolling()
  }

  private startJobPolling() {
    setInterval(async () => {
      if (this.isProcessing) return
      await this.processNextJobs()
    }, 10000) // 10초마다 실행
  }

  private async processNextJobs() {
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

  private async processJob(job: Job) {
    const processor = this.processors[job.type]
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
