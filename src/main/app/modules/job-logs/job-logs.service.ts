import { Injectable } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'

@Injectable()
export class JobLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async getJobLogs(jobId: string) {
    return this.prisma.jobLog.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getLatestJobLog(jobId: string) {
    return this.prisma.jobLog.findFirst({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async createJobLog(jobId: string, message: string, level: 'info' | 'error' | 'warn' = 'info') {
    return this.prisma.jobLog.create({
      data: {
        jobId,
        message,
        level,
      },
    })
  }

  async deleteJobLogsByJobId(jobId: string) {
    return this.prisma.jobLog.deleteMany({
      where: { jobId },
    })
  }

  // 큐 관련 로그 생성 헬퍼 메서드들
  async logQueueStart(jobId: string) {
    return this.createJobLog(jobId, '작업이 큐에 등록되었습니다.')
  }

  async logQueueProgress(jobId: string, progress: number) {
    return this.createJobLog(jobId, `작업 진행률: ${progress}%`)
  }

  async logQueueComplete(jobId: string, result?: string) {
    return this.createJobLog(jobId, result || '작업이 완료되었습니다.')
  }

  async logQueueFailed(jobId: string, error: Error) {
    return this.createJobLog(jobId, `작업 실패: ${error.message}`, 'error')
  }

  async logQueueStalled(jobId: string) {
    return this.createJobLog(jobId, '작업이 지연되었습니다.', 'warn')
  }
}
