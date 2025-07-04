import { Injectable, Logger } from '@nestjs/common'
import { OpenAiService } from '../ai/openai.service'
import { PerplexityService } from '../ai/perplexity.service'
import { ImagePixabayService } from '../media/image-pixabay.service'
import { SettingsService } from '../settings/settings.service'
import axios from 'axios'
import sharp from 'sharp'
import { ThumbnailGeneratorService } from '../media/thumbnail-generator.service'
import { GCSUploadService } from '@main/app/modules/media/gcs-upload.service'

export interface SectionContent {
  html: string
  imageUrl?: string
  links?: any[]
}

export interface ProcessedSection extends SectionContent {
  sectionIndex: number
}

@Injectable()
export class ContentGenerateService {
  private readonly logger = new Logger(ContentGenerateService.name)
  private readonly CONCURRENT_SECTIONS = 3 // 섹션당 동시에 처리할 작업 수

  constructor(
    private readonly openAiService: OpenAiService,
    private readonly perplexityService: PerplexityService,
    private readonly imagePixabayService: ImagePixabayService,
    private readonly gcsUpload: GCSUploadService,
    private readonly settingsService: SettingsService,
    private readonly thumbnailGenerator: ThumbnailGeneratorService,
  ) {}

  /**
   * 섹션들을 병렬로 처리하는 메서드
   */
  async processSectionsInParallel(sections: SectionContent[]): Promise<ProcessedSection[]> {
    const chunks = this.chunkArray(
      sections.map((section, index) => ({ section, index })),
      this.CONCURRENT_SECTIONS,
    )

    const processedSections: ProcessedSection[] = []

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async ({ section, index }) => {
          const sectionIndex = index + 1

          // 이미지, 링크, 광고를 병렬로 처리
          const [imageUrl, links, adHtml] = await Promise.all([
            this.generateImageBySettings(section.html, sectionIndex),
            this.generateLinks(section.html, sectionIndex),
            this.insertAdScript(section.html, sectionIndex),
          ])

          return {
            html: adHtml || section.html,
            imageUrl,
            links,
            sectionIndex,
          }
        }),
      )

      processedSections.push(...chunkResults)
    }

    return processedSections
  }

  /**
   * 링크 생성을 처리하는 메서드
   */
  private async generateLinks(html: string, sectionIndex: number): Promise<any[]> {
    try {
      const links = await this.perplexityService.generateRelevantLinks(html)
      this.logger.log(`섹션 ${sectionIndex}에 대한 관련 링크: ${JSON.stringify(links)}`)
      return links
    } catch (error) {
      this.logger.warn(`섹션 ${sectionIndex} 링크 처리 중 오류: ${error.message}`)
      return []
    }
  }

  /**
   * 썸네일 이미지를 생성하는 함수
   */
  async generateThumbnailImage(title: string, subtitle?: string): Promise<string | undefined> {
    try {
      const settings = await this.settingsService.getAppSettings()

      if (!settings.thumbnailEnabled) {
        this.logger.log('썸네일 생성이 비활성화되어 있습니다.')
        return undefined
      }

      const thumbnailUrl = await this.thumbnailGenerator.generateThumbnailImage(title, subtitle)

      if (thumbnailUrl) {
        this.logger.log(`썸네일 생성 완료: ${thumbnailUrl}`)

        if (thumbnailUrl.startsWith('file://')) {
          try {
            const fs = require('fs')
            const filePath = thumbnailUrl.replace('file://', '')
            const thumbnailBuffer = fs.readFileSync(filePath)

            const uploadResult = await this.gcsUpload.uploadImage(thumbnailBuffer, {
              contentType: 'image/png',
              isPublic: true,
            })

            try {
              fs.unlinkSync(filePath)
            } catch (deleteError) {
              this.logger.warn(`로컬 썸네일 파일 삭제 실패: ${deleteError.message}`)
            }

            return uploadResult.url
          } catch (uploadError) {
            this.logger.error('GCS 업로드 실패:', uploadError)
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
   * 이미지를 WebP 형식으로 변환하고 최적화하는 함수
   */
  private async optimizeImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(imageBuffer).webp({ quality: 80 }).toBuffer()
    } catch (error) {
      this.logger.error('이미지 최적화 중 오류:', error)
      return imageBuffer
    }
  }

  /**
   * 설정에 따라 이미지를 생성하는 함수
   */
  private async generateImageBySettings(html: string, sectionIndex: number): Promise<string | undefined> {
    try {
      const settings = await this.settingsService.getAppSettings()
      const imageType = settings.imageType || 'none'

      switch (imageType) {
        case 'pixabay':
          try {
            const pixabayKeyword = await this.openAiService.generatePixabayPrompt(html)
            this.logger.log(`섹션 ${sectionIndex}에 대한 키워드: ${pixabayKeyword}`)

            const imageUrl = await this.imagePixabayService.searchImage(pixabayKeyword)
            this.logger.log(`섹션 ${sectionIndex}에 대한 이미지 URL: ${imageUrl}`)

            try {
              const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 30000,
              })

              const imageBuffer = Buffer.from(response.data)
              const optimizedBuffer = await this.optimizeImage(imageBuffer)

              const uploadResult = await this.gcsUpload.uploadImage(optimizedBuffer, {
                contentType: 'image/webp',
              })

              this.logger.log(`섹션 ${sectionIndex} Pixabay 이미지 GCS 업로드 완료: ${uploadResult.url}`)
              return uploadResult.url
            } catch (uploadError) {
              this.logger.error(`섹션 ${sectionIndex} Pixabay 이미지 GCS 업로드 실패:`, uploadError)
              return imageUrl
            }
          } catch (error) {
            this.logger.warn(`섹션 ${sectionIndex} Pixabay 이미지 처리 중 오류: ${error.message}`)
            return undefined
          }

        case 'ai':
          try {
            const aiImagePrompt = await this.openAiService.generateAiImagePrompt(html)
            this.logger.log(`섹션 ${sectionIndex}에 대한 AI 이미지 프롬프트: ${aiImagePrompt}`)

            const imageUrl = await this.openAiService.generateImage(aiImagePrompt)
            this.logger.log(`섹션 ${sectionIndex}에 대한 AI 생성 이미지 URL: ${imageUrl}`)

            try {
              const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 30000,
              })

              const imageBuffer = Buffer.from(response.data)
              const optimizedBuffer = await this.optimizeImage(imageBuffer)

              const uploadResult = await this.gcsUpload.uploadImage(optimizedBuffer, {
                contentType: 'image/webp',
              })

              this.logger.log(`섹션 ${sectionIndex} AI 이미지 GCS 업로드 완료: ${uploadResult.url}`)
              return uploadResult.url
            } catch (uploadError) {
              this.logger.error(`섹션 ${sectionIndex} AI 이미지 GCS 업로드 실패:`, uploadError)
              return imageUrl
            }
          } catch (error) {
            this.logger.warn(`섹션 ${sectionIndex} AI 이미지 생성 중 오류: ${error.message}`)
            return undefined
          }

        case 'none':
        default:
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
   */
  private async insertAdScript(html: string, sectionIndex: number): Promise<string | undefined> {
    try {
      const settings = await this.settingsService.getAppSettings()
      const adEnabled = settings.adEnabled || false
      const adScript = settings.adScript

      if (!adEnabled || !adScript || adScript.trim() === '') {
        this.logger.log(`섹션 ${sectionIndex}: 광고 삽입 안함 (활성화: ${adEnabled}, 스크립트 존재: ${!!adScript})`)
        return html
      }

      const htmlWithAd = `${html}\n\n<div class="ad-section" style="margin: 20px 0; text-align: center;">\n${adScript}\n</div>`

      this.logger.log(`섹션 ${sectionIndex}: 광고 스크립트 삽입 완료`)
      return htmlWithAd
    } catch (error) {
      this.logger.warn(`섹션 ${sectionIndex} 광고 삽입 중 오류: ${error.message}`)
      return html
    }
  }

  /**
   * 배열을 청크로 나누는 유틸리티 메서드
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
}
