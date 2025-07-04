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
import { TopicService } from '../topic/topic.service'
import * as XLSX from 'xlsx'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { JobStatus, JobType } from '@main/app/modules/job/job.types'

@Controller('workflow')
export class WorkflowController {
  private readonly logger = new Logger(WorkflowController.name)

  constructor(
    private readonly topicService: TopicService,
    private readonly prisma: PrismaService,
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
    this.logger.log(`주제 찾기 요청: topic=${topic}, limit=${limit}`)

    if (!topic) {
      throw new Error('주제(topic) 파라미터는 필수입니다.')
    }

    try {
      // 1. OpenAI를 통해 SEO 제목 생성
      const topics = await this.topicService.generateTopics(topic, limit)

      // 2. 엑셀 데이터 준비
      const excelData = [
        ['SEO 제목', '내용'], // 헤더
        ...topics.map(item => [item.title, item.content]),
      ]

      // 3. 워크북 및 워크시트 생성
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.aoa_to_sheet(excelData)

      // 4. 컬럼 너비 설정
      worksheet['!cols'] = [
        { width: 40 }, // SEO 제목
        { width: 50 }, // 내용
      ]

      // 5. 워크시트를 워크북에 추가
      XLSX.utils.book_append_sheet(workbook, worksheet, 'SEO 제목 목록')

      // 6. 엑셀 파일 생성
      const fileName = `seo-titles-${new Date().toISOString().split('T')[0]}.xlsx`
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

      // 7. 응답 헤더 설정 및 파일 전송
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.send(buffer)

      this.logger.log(`엑셀 파일 "${fileName}" 내보내기 완료`)
    } catch (error) {
      this.logger.error('워크플로우 실행 중 오류 발생:', error)
      throw error
    }
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
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
    const rows = data.slice(1) // 헤더 제외

    const jobs = await Promise.all(
      rows.map(async ([title, content]) => {
        const job = await this.prisma.job.create({
          data: {
            subject: `${title} 제목 포스팅 등록`,
            desc: `${content}`,
            type: JobType.BLOG_POST,
            status: JobStatus.PENDING,
            priority: 1,
            scheduledAt: new Date(), // 즉시 실행
            blogJob: {
              create: {
                title,
                content,
              },
            },
          },
          include: {
            blogJob: true,
          },
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
