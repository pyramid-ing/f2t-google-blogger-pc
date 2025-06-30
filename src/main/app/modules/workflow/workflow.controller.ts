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
import { GoogleBloggerService } from '@main/app/modules/google/blogger/google-blogger.service'
import { ImagePixabayService } from 'src/main/app/modules/media/image-pixabay.service'
import { ThumbnailGeneratorService } from 'src/main/app/modules/media/thumbnail-generator.service'
import { GCSUploadService } from 'src/main/app/modules/media/gcs-upload.service'
import { SettingsService } from '../settings/settings.service'
import { OpenAiService } from '../ai/openai.service'
import { LinkResult, PerplexityService } from '../ai/perplexity.service'

@Controller('workflow')
export class WorkflowController {
  private readonly logger = new Logger(WorkflowController.name)

  constructor(
    private readonly topicService: TopicService,
    private readonly bloggerService: GoogleBloggerService,
    private readonly imageAgent: ImagePixabayService,
    private readonly thumbnailGenerator: ThumbnailGeneratorService,
    private readonly gcsUpload: GCSUploadService,
    private readonly settingsService: SettingsService,
    private readonly openAiService: OpenAiService,
    private readonly perplexityService: PerplexityService,
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
  async registerWorkflow(@UploadedFile() file: any, @Res() res: Response): Promise<void> {
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

        // 5. sections 배열 루프하면서 이미지, 링크 및 광고 처리
        for (let i = 0; i < detailedContent.sections.length; i++) {
          const section = detailedContent.sections[i]
          let imageUrl: string | undefined
          let links: LinkResult[] = []
          let sectionHtml = section.html

          // 이미지 생성 처리
          imageUrl = await this.generateImageBySettings(section.html, i + 1)

          try {
            // Perplexity를 통한 관련 링크 생성
            links = await this.perplexityService.generateRelevantLinks(section.html)
            this.logger.log(`섹션 ${i + 1}에 대한 관련 링크: ${JSON.stringify(links)}`)
          } catch (error) {
            this.logger.warn(`섹션 ${i + 1} 링크 처리 중 오류: ${error.message}`)
          }

          // 광고 스크립트 추가
          try {
            const adScript = await this.insertAdScript(section.html, i + 1)
            if (adScript) {
              sectionHtml = adScript
            }
          } catch (error) {
            this.logger.warn(`섹션 ${i + 1} 광고 삽입 중 오류: ${error.message}`)
          }

          // 섹션에 이미지 URL, 링크, 광고가 추가된 HTML 및 AI 이미지 프롬프트 적용
          detailedContent.sections[i] = {
            html: sectionHtml,
            imageUrl,
            links,
          }
        }

        // 6. 썸네일 이미지 생성 및 추가
        let thumbnailHtml = ''
        try {
          const thumbnailImageUrl = await this.generateThumbnailImage(title, description)
          if (thumbnailImageUrl) {
            thumbnailHtml = `<div style="text-align: center; margin-bottom: 30px;">
              <img src="${thumbnailImageUrl}" alt="${title}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" />
            </div>`
            this.logger.log(`썸네일 이미지 생성 완료: ${thumbnailImageUrl}`)
          }
        } catch (error) {
          this.logger.warn(`썸네일 생성 중 오류: ${error.message}`)
        }

        // // 7. HTML로 합치기 (썸네일 포함)
        const combinedHtml = thumbnailHtml + this.topicService.combineHtmlSections(detailedContent)
        console.log(combinedHtml)

        // 8. Blogger API로 포스팅하기
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
   * 썸네일 이미지를 생성하는 함수 (React-Konva 방식)
   * @param title - 포스트 제목
   * @param subtitle - 포스트 부제목 (선택사항)
   * @returns 썸네일 이미지 URL 또는 undefined
   */
  async generateThumbnailImage(title: string, subtitle?: string): Promise<string | undefined> {
    try {
      const settings = await this.settingsService.getAppSettings()

      // 썸네일 생성이 비활성화된 경우
      if (!settings.thumbnailEnabled) {
        this.logger.log('썸네일 생성이 비활성화되어 있습니다.')
        return undefined
      }

      // React-Konva 방식으로 썸네일 생성
      const thumbnailUrl = await this.thumbnailGenerator.generateThumbnailImage(title, subtitle)

      if (thumbnailUrl) {
        this.logger.log(`React-Konva 방식 썸네일 생성 완료: ${thumbnailUrl}`)

        // 로컬 파일 URL인 경우 GCS 업로드 시도
        if (thumbnailUrl.startsWith('file://')) {
          try {
            // 파일을 Buffer로 읽어오기
            const fs = require('fs')
            const filePath = thumbnailUrl.replace('file://', '')
            const thumbnailBuffer = fs.readFileSync(filePath)

            // GCS에 업로드
            const uploadResult = await this.gcsUpload.uploadImage(thumbnailBuffer, {
              contentType: 'image/png',
              isPublic: true,
            })

            // 업로드 성공 시 로컬 파일 삭제
            try {
              fs.unlinkSync(filePath)
            } catch (deleteError) {
              this.logger.warn(`로컬 썸네일 파일 삭제 실패: ${deleteError.message}`)
            }

            return uploadResult.url
          } catch (uploadError) {
            this.logger.error('GCS 업로드 실패:', uploadError)
            // 업로드 실패 시 로컬 URL 반환
            return thumbnailUrl
          }
        }

        return thumbnailUrl
      }

      return undefined
    } catch (error) {
      this.logger.error('썸네일 생성 실패:', error)
      return undefined
    }
  }

  /**
   * 설정에 따라 이미지를 생성하는 함수
   * @param html - 섹션의 HTML 내용
   * @param sectionIndex - 섹션 번호
   * @returns 이미지 URL 또는 undefined
   */
  async generateImageBySettings(html: string, sectionIndex: number): Promise<string | undefined> {
    try {
      // 현재 이미지 설정 가져오기
      const settings = await this.settingsService.getAppSettings()
      const imageType = settings.imageType || 'none'

      switch (imageType) {
        case 'pixabay':
          try {
            // Pixabay 이미지 검색용 프롬프트 생성
            const pixabayKeyword = await this.openAiService.generatePixabayPrompt(html)
            this.logger.log(`섹션 ${sectionIndex}에 대한 키워드: ${pixabayKeyword}`)

            // 이미지 검색 및 링크 적용
            const imageUrl = await this.imageAgent.searchImage(pixabayKeyword)
            this.logger.log(`섹션 ${sectionIndex}에 대한 이미지 URL: ${imageUrl}`)
            return imageUrl
          } catch (error) {
            this.logger.warn(`섹션 ${sectionIndex} Pixabay 이미지 처리 중 오류: ${error.message}`)
            return undefined
          }

        case 'ai':
          try {
            // HTML 콘텐츠를 분석해서 AI 이미지 프롬프트 생성
            const aiImagePrompt = await this.openAiService.generateAiImagePrompt(html)
            this.logger.log(`섹션 ${sectionIndex}에 대한 AI 이미지 프롬프트: ${aiImagePrompt}`)

            // OpenAI DALL-E로 이미지 생성
            const imageUrl = await this.openAiService.generateImage(aiImagePrompt)
            this.logger.log(`섹션 ${sectionIndex}에 대한 AI 생성 이미지 URL: ${imageUrl}`)

            // AI 생성 이미지를 GCS에 업로드
            try {
              // 이미지 URL에서 데이터 다운로드 (axios 사용)
              const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 30000, // 30초 타임아웃
              })

              const imageBuffer = Buffer.from(response.data)

              // GCS에 업로드
              const uploadResult = await this.gcsUpload.uploadImage(imageBuffer, {
                contentType: 'image/png',
                isPublic: true,
              })

              this.logger.log(`섹션 ${sectionIndex} AI 이미지 GCS 업로드 완료: ${uploadResult.url}`)
              return uploadResult.url
            } catch (uploadError) {
              this.logger.error(`섹션 ${sectionIndex} AI 이미지 GCS 업로드 실패:`, uploadError)
              // 업로드 실패 시 원본 URL 반환
              return imageUrl
            }
          } catch (error) {
            this.logger.warn(`섹션 ${sectionIndex} AI 이미지 생성 중 오류: ${error.message}`)
            return undefined
          }

        case 'none':
        default:
          // 이미지를 사용하지 않음
          this.logger.log(`섹션 ${sectionIndex}: 이미지 사용 안함 설정`)
          return undefined
      }
    } catch (error) {
      this.logger.warn(`섹션 ${sectionIndex} 이미지 처리 중 오류: ${error.message}`)
      return undefined
    }
  }

  /**
   * 설정에 따라 광고 스크립트를 삽입하는 함수
   * @param html - 섹션의 HTML 내용
   * @param sectionIndex - 섹션 번호
   * @returns 광고가 삽입된 HTML 또는 undefined
   */
  async insertAdScript(html: string, sectionIndex: number): Promise<string | undefined> {
    try {
      // 현재 광고 설정 가져오기
      const settings = await this.settingsService.getAppSettings()
      const adEnabled = settings.adEnabled || false
      const adScript = settings.adScript

      // 광고가 비활성화되어 있거나 광고 스크립트가 없으면 원본 HTML 반환
      if (!adEnabled || !adScript || adScript.trim() === '') {
        this.logger.log(`섹션 ${sectionIndex}: 광고 삽입 안함 (활성화: ${adEnabled}, 스크립트 존재: ${!!adScript})`)
        return html
      }

      // 광고 스크립트를 섹션 끝에 추가
      const htmlWithAd = `${html}\n\n<div class="ad-section" style="margin: 20px 0; text-align: center;">\n${adScript}\n</div>`

      this.logger.log(`섹션 ${sectionIndex}: 광고 스크립트 삽입 완료`)
      return htmlWithAd
    } catch (error) {
      this.logger.warn(`섹션 ${sectionIndex} 광고 삽입 중 오류: ${error.message}`)
      return html
    }
  }
}
