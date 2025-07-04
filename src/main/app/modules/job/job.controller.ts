import { Controller, Get, Post, Delete, Param, Query, HttpException, HttpStatus } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { JobQueueProcessor } from './job-queue.processor'
import { Prisma } from '@prisma/client'

// 작업 타입 상수
export const JOB_TYPE = {
  POST: 'post',
  GENERATE_TOPIC: 'generate_topic',
} as const

// 작업 상태 상수
export const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export type JobType = (typeof JOB_TYPE)[keyof typeof JOB_TYPE]
export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS]

@Controller('api/jobs')
export class JobController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobProcessor: JobQueueProcessor,
  ) {}

  @Get()
  async getJobs(
    @Query('status') status?: JobStatus,
    @Query('search') search?: string,
    @Query('orderBy') orderBy: string = 'updatedAt',
    @Query('order') order: 'asc' | 'desc' = 'desc',
  ) {
    try {
      const where: Prisma.JobWhereInput = {}

      // 상태 필터
      if (status) {
        where.status = status
      }

      // 검색 필터
      if (search) {
        where.OR = [
          { subject: { contains: search } },
          { desc: { contains: search } },
          { resultMsg: { contains: search } },
        ]
      }

      const jobs = await this.prisma.job.findMany({
        where,
        orderBy: {
          [orderBy]: order,
        },
        include: {
          logs: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      })

      return jobs
    } catch (error) {
      throw new HttpException('작업 목록을 가져오는데 실패했습니다.', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get(':id/logs')
  async getJobLogs(@Param('id') jobId: string) {
    try {
      const logs = await this.prisma.jobLog.findMany({
        where: { jobId },
        orderBy: { createdAt: 'desc' },
      })

      return logs
    } catch (error) {
      throw new HttpException('작업 로그를 가져오는데 실패했습니다.', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get(':id/logs/latest')
  async getLatestJobLog(@Param('id') jobId: string) {
    try {
      const log = await this.prisma.jobLog.findFirst({
        where: { jobId },
        orderBy: { createdAt: 'desc' },
      })

      return log
    } catch (error) {
      throw new HttpException('최신 로그를 가져오는데 실패했습니다.', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Post(':id/retry')
  async retryJob(@Param('id') jobId: string) {
    try {
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
      })

      if (!job) {
        throw new HttpException('작업을 찾을 수 없습니다.', HttpStatus.NOT_FOUND)
      }

      // 작업 상태를 pending으로 변경
      await this.prisma.job.update({
        where: { id: jobId },
        data: {
          status: JOB_STATUS.PENDING,
          resultMsg: null,
          resultUrl: null,
          errorMessage: null,
        },
      })

      // 작업 로그 추가
      await this.prisma.jobLog.create({
        data: {
          jobId,
          message: '작업이 재시도됩니다.',
        },
      })

      // 작업 큐에 다시 추가
      await this.jobProcessor.processJob(job)

      return {
        success: true,
        message: '작업이 재시도됩니다.',
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }
      throw new HttpException('작업 재시도에 실패했습니다.', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Delete(':id')
  async deleteJob(@Param('id') jobId: string) {
    try {
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
      })

      if (!job) {
        throw new HttpException('작업을 찾을 수 없습니다.', HttpStatus.NOT_FOUND)
      }

      if (job.status === JOB_STATUS.PROCESSING) {
        throw new HttpException('처리 중인 작업은 삭제할 수 없습니다.', HttpStatus.BAD_REQUEST)
      }

      // 작업과 관련된 로그 삭제는 Prisma의 onDelete: Cascade로 자동 처리됨
      await this.prisma.job.delete({
        where: { id: jobId },
      })

      return {
        success: true,
        message: '작업이 삭제되었습니다.',
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }
      throw new HttpException('작업 삭제에 실패했습니다.', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
