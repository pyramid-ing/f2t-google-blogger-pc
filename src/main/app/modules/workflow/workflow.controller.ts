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
import { Express } from 'express'

@Controller('workflow')
export class WorkflowController {
  private readonly logger = new Logger(WorkflowController.name)

  constructor(private readonly topicService: TopicService) {}

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
  async registerWorkflow(@UploadedFile() file: Express.Multer.File, @Res() res: Response): Promise<void> {
    this.logger.log('워크플로우 등록 요청')

    if (!file) {
      throw new Error('엑셀 파일은 필수입니다.')
    }

    try {
      // 1. 엑셀 파일 파싱
      const workbook = XLSX.read(file.buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

      // 2. 각 행별로 처리
      for (const row of data.slice(1)) {
        // 첫 번째 행은 헤더
        const [title, description] = row
        this.logger.log(`포스팅 처리: 제목=${title}, 설명=${description}`)

        // 3. 포스팅 목차 생성
        const tableOfContents = await this.topicService.generateTableOfContents(title, description)
        this.logger.log(`생성된 목차: ${JSON.stringify(tableOfContents)}`)

        // 4. 포스팅 내용 구체적으로 만들기
        for (const section of tableOfContents) {
          const detailedContent = await this.topicService.generateContentWithOpenAI(section)
          this.logger.log(`섹션: ${section.title}, 내용: ${detailedContent}`)
        }
      }

      res.status(201).send('워크플로우 등록 완료')
      this.logger.log('워크플로우 등록 완료')
    } catch (error) {
      this.logger.error('워크플로우 등록 중 오류 발생:', error)
      throw error
    }
  }

  /**
   * SEO 최적화된 콘텐츠 생성
   * @param {string} mainTitle - 콘텐츠의 메인 제목
   * @param {string[]} topics - 각 섹션의 주제 목록
   */
  generateSEOContent(mainTitle: string, topics: string[]) {
    // 변수 설정
    const style = '친근한'
    const format = '마크다운'
    const length = 1200 // 총 목표 분량
    const targetAudience = '일반 대중'
    const purpose = 'SEO 최적화된 블로그 포스트 작성'

    // 섹션 배열 생성
    const sections = topics.map((topic, index) => ({
      title: `Section ${index + 1}: ${topic}`,
      summary: `${topic}에 대한 내용을 다룹니다.`,
      targetLength: 300,
      content: [
        { heading: 'h2', text: topic },
        { heading: 'p', text: `${topic}에 대한 상세 설명입니다.` },
      ],
    }))

    // 각 섹션에 대해 작업 수행
    sections.forEach(section => {
      // 단어 수 추적 및 확장
      let currentLength = 0
      section.content.forEach(item => {
        currentLength += item.text.split(' ').length
      })

      while (currentLength < section.targetLength) {
        // 관련 내용 확장
        const additionalContent = this.generateContent(section.title, style, format)
        section.content.push({ heading: 'p', text: additionalContent })
        currentLength += additionalContent.split(' ').length
      }
    })

    // SEO 전략 적용
    this.applySEO(sections)

    // 결과 출력
    console.log(sections)
  }

  // Dummy functions for content generation and SEO application
  generateContent(title: string, style: string, format: string): string {
    return `Generated content for ${title} in ${style} style and ${format} format.`
  }

  applySEO(sections: any[]): void {
    console.log('SEO strategies applied.')
  }
}
