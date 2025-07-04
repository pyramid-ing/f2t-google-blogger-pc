import {
  Controller,
  Get,
  Post,
  Logger,
  Query,
  Res,
  ParseIntPipe,
  DefaultValuePipe,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import * as XLSX from 'xlsx'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { JobStatus, JobType } from '@main/app/modules/job/job.types'
import { TopicJobService } from '../topic/topic-job.service'
import { parse, isValid } from 'date-fns'

@Controller('workflow')
export class WorkflowController {
  private readonly logger = new Logger(WorkflowController.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly topicJobService: TopicJobService,
  ) {}

  /**
   * SEO 최적화된 주제 찾기 및 엑셀 다운로드
   * GET /workflow/find-topics?topic=소상공인&limit=10
   */
  @Get('find-topics')
  async findTopics(
    @Query('topic') topic: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Res() res: Response,
  ): Promise<void> {
    this.logger.log(`주제 찾기(비동기 job 등록): topic=${topic}, limit=${limit}`)

    if (!topic) {
      throw new Error('주제(topic) 파라미터는 필수입니다.')
    }

    // 1. 토픽 생성 job 등록
    const job = await this.topicJobService.createTopicJob(topic, limit)

    // 2. 등록된 jobId 반환 (즉시 결과가 아닌, jobId로 상태/결과를 polling)
    res.status(202).json({
      success: true,
      message: '토픽 생성 작업이 등록되었습니다.',
      jobId: job.id,
    })
  }

  /**
   * 워크플로우 등록
   * POST /workflow/post
   */
  @Post('post')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAndQueue(@UploadedFile() file: any, @Res() res: Response): Promise<void> {
    if (!file) throw new Error('엑셀 파일은 필수입니다.')

    const workbook = XLSX.read(file.buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    // 한글 헤더 기반으로 객체 파싱
    const data = XLSX.utils.sheet_to_json(worksheet) as any[]

    const jobs = await Promise.all(
      data.map(async row => {
        const title = row['제목'] || ''
        const content = row['내용'] || ''
        const scheduledAt = row['예약날짜'] || ''
        let scheduledAtDate: Date
        if (scheduledAt && typeof scheduledAt === 'string' && scheduledAt.trim() !== '') {
          const parsed = parse(scheduledAt.trim(), 'yyyy-MM-dd HH:mm', new Date())
          scheduledAtDate = isValid(parsed) ? parsed : new Date()
        } else {
          scheduledAtDate = new Date()
        }

        const job = await this.prisma.job.create({
          data: {
            subject: `${title} 제목 포스팅 등록`,
            desc: `${content}`,
            type: JobType.BLOG_POST,
            status: JobStatus.PENDING,
            priority: 1,
            scheduledAt: scheduledAtDate,
            blogJob: {
              create: { title, content },
            },
          },
          include: { blogJob: true },
        })

        await this.prisma.jobLog.create({
          data: {
            jobId: job.id,
            level: 'info',
            message: '작업이 등록되었습니다.',
          },
        })

        return job
      }),
    )

    this.logger.log(`✅ 총 ${jobs.length}건의 포스트 작업이 Job Queue에 등록됨`)

    res.status(201).json({
      success: true,
      message: `${jobs.length}건 등록 완료`,
      jobIds: jobs.map(job => job.id),
    })
  }
}
