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
import { GoogleBloggerService } from '@main/app/modules/google/blogger/google-blogger.service'
import { ImageAgent } from '../media/image.agent'
import { SettingsService } from '../settings/settings.service'
import OpenAI from 'openai'

@Controller('workflow')
export class WorkflowController {
  private readonly logger = new Logger(WorkflowController.name)

  constructor(
    private readonly topicService: TopicService,
    private readonly bloggerService: GoogleBloggerService,
    private readonly imageAgent: ImageAgent,
    private readonly settingsService: SettingsService,
  ) {}

  private async getOpenAI(): Promise<OpenAI> {
    const settings = await this.settingsService.getAppSettings()
    const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY

    if (!apiKey) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.')
    }

    return new OpenAI({
      apiKey,
    })
  }

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
        // // 첫 번째 행은 헤더
        const [title, description] = row
        this.logger.log(`포스팅 처리: 제목=${title}, 설명=${description}`)

        // 3. 포스팅 목차 생성
        const blogOutline = await this.topicService.generateBlogOutline(title, description)
        this.logger.log(`생성된 목차: ${JSON.stringify(blogOutline.sections)}`)

        // 4. 포스팅 내용 구체적으로 만들기
        const detailedContent = await this.topicService.generatePostingContentsWithOpenAI(blogOutline)

        // 5. sections 배열 루프하면서 이미지 처리
        for (let i = 0; i < detailedContent.sections.length; i++) {
          const section = detailedContent.sections[i]

          try {
            // Pixabay 이미지 검색용 프롬프트 생성
            const pixabayKeyword = await this.generatePixabayPrompt(section.html)
            this.logger.log(`섹션 ${i + 1}에 대한 키워드: ${pixabayKeyword}`)

            // 이미지 검색 및 링크 적용
            const imageUrl = await this.imageAgent.searchImage(pixabayKeyword)
            this.logger.log(`섹션 ${i + 1}에 대한 이미지 URL: ${imageUrl}`)

            // 섹션에 이미지 URL 추가
            detailedContent.sections[i] = {
              html: section.html,
              imageUrl,
            }
          } catch (error) {
            this.logger.warn(`섹션 ${i + 1} 이미지 처리 중 오류: ${error.message}`)
            // 이미지 처리 실패 시 원본 HTML 유지
          }
        }

        // 6. HTML로 합치기
        const combinedHtml = this.topicService.combineHtmlSections(detailedContent)
        console.log(combinedHtml)

        // 7. Blogger API로 포스팅하기
        const bloggerResponse = await this.bloggerService.postToBlogger({
          title,
          content: combinedHtml,
        })

        // 등록 결과 정보 출력
        this.logger.log(`✅ Blogger에 포스팅 완료!`)
        this.logger.log(`📝 제목: ${bloggerResponse.title}`)
        this.logger.log(`🔗 URL: ${bloggerResponse.url}`)
        this.logger.log(`📅 발행일: ${bloggerResponse.published}`)
        this.logger.log(`🆔 포스트 ID: ${bloggerResponse.id}`)
      }

      res.status(201).json({
        success: true,
        message: '워크플로우 등록 완료',
        processedCount: data.slice(1).length,
        timestamp: new Date().toISOString(),
      })
      this.logger.log(`🎉 전체 워크플로우 등록 완료 - 총 ${data.slice(1).length}개 포스트 처리됨`)
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

  /**
   * HTML 컨텐츠에서 Pixabay 이미지 검색용 키워드 생성
   */
  async generatePixabayPrompt(htmlContent: string): Promise<string> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system' as const,
        content: `
You are an expert in generating keywords for automated image search.

Read the content provided by the user and extract exactly 3 core keywords that can represent the content.
Provide concise and intuitive noun-based keywords in ENGLISH for input into image search engines like Pixabay.

The keywords should be:
- In English only
- Simple and clear nouns or noun phrases
- Relevant to the main topic of the content
- Suitable for finding professional stock photos
`,
      },
      {
        role: 'user' as const,
        content: htmlContent,
      },
    ]

    try {
      const openai = await this.getOpenAI()
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'pixabay_keywords',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                pixabayKeywords: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                  minItems: 3,
                  maxItems: 3,
                  description: 'Pixabay 이미지 검색을 위한 3개의 키워드',
                },
              },
              required: ['pixabayKeywords'],
              additionalProperties: false,
            },
          },
        },
        temperature: 0.3,
      })

      const response = JSON.parse(completion.choices[0].message.content)
      return response.pixabayKeywords?.join(' ') || 'business office'
    } catch (error) {
      this.logger.error('Pixabay 프롬프트 생성 중 오류:', error)
      return 'business office' // 기본값 반환
    }
  }
}
