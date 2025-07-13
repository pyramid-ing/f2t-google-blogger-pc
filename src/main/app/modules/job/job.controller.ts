import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { JobQueueProcessor } from './job-queue.processor'
import { Prisma } from '@prisma/client'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

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
    @Query('type') type?: JobType,
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

      // 타입 필터
      if (type) {
        where.type = type
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
          blogJob: true,
          topicJob: true,
        },
      })

      return jobs
    } catch (error) {
      throw new HttpException('작업 목록을 가져오는데 실패했습니다.', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Post('bulk/retry')
  async retryJobs(@Body() body: { jobIds: string[] }) {
    try {
      const { jobIds } = body

      if (!jobIds || jobIds.length === 0) {
        throw new HttpException('작업 ID가 제공되지 않았습니다.', HttpStatus.BAD_REQUEST)
      }

      const jobs = await this.prisma.job.findMany({
        where: {
          id: { in: jobIds },
        },
      })

      if (jobs.length === 0) {
        throw new HttpException('작업을 찾을 수 없습니다.', HttpStatus.NOT_FOUND)
      }

      // 실패한 작업만 필터링
      const failedJobs = jobs.filter(job => job.status === JOB_STATUS.FAILED)
      const nonFailedJobs = jobs.filter(job => job.status !== JOB_STATUS.FAILED)

      let successCount = 0
      let failedCount = 0
      const errors: string[] = []

      for (const job of failedJobs) {
        try {
          // 작업 상태를 pending으로 변경
          await this.prisma.job.update({
            where: { id: job.id },
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
              jobId: job.id,
              message: '작업이 재시도됩니다.',
            },
          })

          // 작업 큐에 다시 추가
          await this.jobProcessor.processJob(job)
          successCount++
        } catch (error) {
          failedCount++
          errors.push(`작업 ${job.id}: ${error.message}`)
        }
      }

      // 실패하지 않은 작업이 있다면 메시지에 포함
      if (nonFailedJobs.length > 0) {
        errors.push(`실패하지 않은 작업 ${nonFailedJobs.length}개는 재시도에서 제외되었습니다.`)
      }

      return {
        success: true,
        message: `${successCount}개 작업이 재시도되었습니다.`,
        details: {
          successCount,
          failedCount,
          errors,
        },
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }
      throw new HttpException('벌크 재시도에 실패했습니다.', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Post('bulk/delete')
  async deleteJobs(@Body() body: { jobIds: string[] }) {
    try {
      const { jobIds } = body

      if (!jobIds || jobIds.length === 0) {
        throw new HttpException('작업 ID가 제공되지 않았습니다.', HttpStatus.BAD_REQUEST)
      }

      const jobs = await this.prisma.job.findMany({
        where: {
          id: { in: jobIds },
        },
      })

      if (jobs.length === 0) {
        throw new CustomHttpException(ErrorCode.USER_NOT_FOUND, { jobIds })
      }

      // 처리 중인 작업 제외 및 삭제 가능한 작업 필터링
      const processingJobs = jobs.filter(job => job.status === JOB_STATUS.PROCESSING)
      const deletableJobs = jobs.filter(job => job.status !== JOB_STATUS.PROCESSING)

      let successCount = 0
      let failedCount = 0
      const errors: string[] = []

      for (const job of deletableJobs) {
        try {
          // 작업과 관련된 로그 삭제는 Prisma의 onDelete: Cascade로 자동 처리됨
          await this.prisma.job.delete({
            where: { id: job.id },
          })
          successCount++
        } catch (error) {
          failedCount++
          errors.push(`작업 ${job.id}: ${error.message}`)
        }
      }

      // 처리 중인 작업이 있다면 메시지에 포함
      if (processingJobs.length > 0) {
        errors.push(`처리 중인 작업 ${processingJobs.length}개는 삭제에서 제외되었습니다.`)
      }

      return {
        success: true,
        message: `${successCount}개 작업이 삭제되었습니다.`,
        details: {
          successCount,
          failedCount,
          errors,
        },
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }
      throw new HttpException('벌크 삭제에 실패했습니다.', HttpStatus.INTERNAL_SERVER_ERROR)
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
        throw new CustomHttpException(ErrorCode.USER_NOT_FOUND, { jobId })
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
