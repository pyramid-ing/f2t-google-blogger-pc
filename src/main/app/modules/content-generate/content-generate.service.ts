import { Injectable, Logger } from '@nestjs/common'
import { BlogOutline, BlogPost, OpenAiService } from '../ai/openai.service'
import { LinkResult, PerplexityService } from '../ai/perplexity.service'
import { ImagePixabayService } from '../media/image-pixabay.service'
import { SettingsService } from '../settings/settings.service'
import axios from 'axios'
import sharp from 'sharp'
import { ThumbnailGeneratorService } from '../media/thumbnail-generator.service'
import { StorageService } from '@main/app/modules/google/storage/storage.service'
import { postingContentsPrompt, tableOfContentsPrompt } from '@main/app/modules/content-generate/prompts'

export interface SectionContent {
  html: string
  imageUrl?: string
  adHtml?: string
  links?: any[]
}

export interface ProcessedSection extends SectionContent {
  sectionIndex: number
}

@Injectable()
export class ContentGenerateService {
  private readonly logger = new Logger(ContentGenerateService.name)

  constructor(
    private readonly openAiService: OpenAiService,
    private readonly perplexityService: PerplexityService,
    private readonly imagePixabayService: ImagePixabayService,
    private readonly storageService: StorageService,
    private readonly settingsService: SettingsService,
    private readonly thumbnailGenerator: ThumbnailGeneratorService,
  ) {}

  async generate(title: string, desc: string): Promise<string> {
    const blogOutline = await this.generateBlogOutline(title, desc)
    const blogPost = await this.generateBlogPost(blogOutline)

    // 이미지, 링크, 광고, AI 이미지 프롬프트 등 섹션별로 처리
    const processedSections: ProcessedSection[] = await Promise.all(
      blogPost.sections.map(async (section: SectionContent, sectionIndex: number) => {
        const [imageUrl, links, adHtml, aiImagePrompt] = await Promise.all([
          this.generateAndUploadImage(section.html, sectionIndex),
          this.generateLinks(section.html, sectionIndex),
          this.generateAdScript(sectionIndex),
          this.openAiService.generateAiImagePrompt(section.html),
        ])
        return {
          ...section,
          sectionIndex,
          imageUrl,
          links,
          adHtml,
          aiImagePrompt,
        }
      }),
    )
    // 섹션 순서 유지를 위해 정렬
    processedSections.sort((a, b) => a.sectionIndex - b.sectionIndex)

    // SEO 정보 생성 (예시: 첫 섹션 기준, 실제로는 더 복잡하게 가능)
    const allSectionsHtml = processedSections.map(s => s.html).join('\n')
    const seo = await this.generateSeo(allSectionsHtml, 0)

    // 썸네일 이미지 생성
    // const thumbnailUrl = await this.generateThumbnailImage(title)
    const thumbnailUrl = undefined

    // BlogPost 객체 생성 (새로운 요소 포함)
    const blogPostWithMeta: BlogPost = {
      thumbnailUrl,
      seo,
      sections: processedSections.map(({ sectionIndex, adHtml, ...rest }) => rest),
    }

    // HTML 결합 (thumbnailUrl, seo 등 포함)
    const combinedHtml = this.combineHtmlSections(blogPostWithMeta)

    return combinedHtml
  }

  /**
   * 링크 생성을 처리하는 메서드
   */
  private async generateLinks(html: string, sectionIndex: number): Promise<LinkResult[]> {
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
   * 링크 생성을 처리하는 메서드
   */
  private async generateSeo(html: string, sectionIndex: number): Promise<string> {
    try {
      return ''
    } catch (error) {
      this.logger.warn(`섹션 ${sectionIndex} 링크 처리 중 오류: ${error.message}`)
      return ''
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

            const uploadResult = await this.storageService.uploadImage(thumbnailBuffer, {
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
  private async generateAndUploadImage(html: string, sectionIndex: number): Promise<string | undefined> {
    try {
      const settings = await this.settingsService.getAppSettings()
      const imageType = settings.imageType || 'none'

      let imageUrl: string | undefined

      if (imageType === 'pixabay') {
        try {
          const pixabayKeyword = await this.openAiService.generatePixabayPrompt(html)
          this.logger.log(`섹션 ${sectionIndex}에 대한 키워드: ${pixabayKeyword}`)
          imageUrl = await this.imagePixabayService.searchImage(pixabayKeyword)
          this.logger.log(`섹션 ${sectionIndex}에 대한 이미지 URL: ${imageUrl}`)
        } catch (error) {
          this.logger.warn(`섹션 ${sectionIndex} Pixabay 이미지 처리 중 오류: ${error.message}`)
          return undefined
        }
      } else if (imageType === 'ai') {
        try {
          const aiImagePrompt = await this.openAiService.generateAiImagePrompt(html)
          this.logger.log(`섹션 ${sectionIndex}에 대한 AI 이미지 프롬프트: ${aiImagePrompt}`)
          imageUrl = await this.openAiService.generateImage(aiImagePrompt)
          this.logger.log(`섹션 ${sectionIndex}에 대한 AI 생성 이미지 URL: ${imageUrl}`)
        } catch (error) {
          this.logger.warn(`섹션 ${sectionIndex} AI 이미지 생성 중 오류: ${error.message}`)
          return undefined
        }
      } else {
        this.logger.log(`섹션 ${sectionIndex}: 이미지 사용 안함 설정`)
        return undefined
      }

      // 공통: 이미지 다운로드 및 업로드
      if (imageUrl) {
        try {
          const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
          })

          const imageBuffer = Buffer.from(response.data)
          const optimizedBuffer = await this.optimizeImage(imageBuffer)

          const uploadResult = await this.storageService.uploadImage(optimizedBuffer, {
            contentType: 'image/webp',
          })

          this.logger.log(`섹션 ${sectionIndex} 이미지 GCS 업로드 완료: ${uploadResult.url}`)
          return uploadResult.url
        } catch (uploadError) {
          this.logger.error(`섹션 ${sectionIndex} 이미지 GCS 업로드 실패:`, uploadError)
          return imageUrl
        }
      }
      return undefined
    } catch (error) {
      this.logger.warn(`섹션 ${sectionIndex} 이미지 처리 중 오류: ${error.message}`)
      return undefined
    }
  }

  /**
   * 설정에 따라 광고 스크립트를 삽입하는 함수
   */
  private async generateAdScript(sectionIndex: number): Promise<string | undefined> {
    try {
      const settings = await this.settingsService.getAppSettings()
      const adEnabled = settings.adEnabled || false
      const adScript = settings.adScript

      if (!adEnabled || !adScript || adScript.trim() === '') {
        this.logger.log(`섹션 ${sectionIndex}: 광고 삽입 안함 (활성화: ${adEnabled}, 스크립트 존재: ${!!adScript})`)
        return undefined
      }

      this.logger.log(`섹션 ${sectionIndex}: 광고 스크립트 삽입 완료`)
      return `$<div class="ad-section" style="margin: 20px 0; text-align: center;">\n${adScript}\n</div>`
    } catch (error) {
      this.logger.warn(`섹션 ${sectionIndex} 광고 삽입 중 오류: ${error.message}`)
      return undefined
    }
  }

  /**
   * OpenAI를 사용하여 목차 생성
   */
  async generateBlogOutline(title: string, description: string): Promise<BlogOutline> {
    this.logger.log(`OpenAI로 주제 "${title}"에 대한 목차를 생성합니다.`)

    const systemPrompt = tableOfContentsPrompt

    try {
      const openai = await this.openAiService.getOpenAI()
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `title: ${title}, description: ${description}`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'blog_outline',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                sections: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      index: { type: 'integer', description: '섹션 순서' },
                      title: { type: 'string', description: '제목' },
                      summary: { type: 'string', description: '요약' },
                      length: {
                        type: 'string',
                        description: "예상 글자 수 (ex: '250자')",
                        pattern: '^[0-9]+자$',
                      },
                    },
                    required: ['index', 'title', 'summary', 'length'],
                    additionalProperties: false,
                  },
                  minItems: 1,
                },
              },
              required: ['sections'],
              additionalProperties: false,
            },
          },
        },
      })

      const response: BlogOutline = JSON.parse(completion.choices[0].message.content)
      return response
    } catch (error) {
      this.logger.error('OpenAI API 호출 중 오류 발생:', error)
      throw new Error(`OpenAI API 오류: ${error.message}`)
    }
  }

  async generateBlogPost(blogOutline: BlogOutline): Promise<BlogPost> {
    const systemPrompt = postingContentsPrompt

    try {
      const openai = await this.openAiService.getOpenAI()
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `${JSON.stringify(blogOutline)}`,
          },
        ],
        temperature: 0.7,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'blog_post_html',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                sections: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      html: { type: 'string', description: 'HTML content for each section' },
                    },
                    required: ['html'],
                    additionalProperties: false,
                  },
                  minItems: 1,
                },
              },
              required: ['sections'],
              additionalProperties: false,
            },
          },
        },
      })

      const response: BlogPost = JSON.parse(completion.choices[0].message.content)
      return response
    } catch (error) {
      this.logger.error('OpenAI API 호출 중 오류 발생:', error)
      throw new Error(`OpenAI API 오류: ${error.message}`)
    }
  }

  /**
   * Combine HTML sections into a single HTML string
   * BlogPost에 thumbnailUrl, seo 등 메타 정보도 포함
   */
  combineHtmlSections(blogPostHtml: BlogPost): string {
    let html = ''
    // 썸네일
    if (blogPostHtml.thumbnailUrl) {
      html += `<img src="${blogPostHtml.thumbnailUrl}" alt="thumbnail" style="width: 100%; height: auto; margin-bottom: 20px;" />\n`
    }
    // SEO (jsonLd)
    if (blogPostHtml.seo) {
      html += `<script type="application/ld+json">${blogPostHtml.seo}</script>\n`
    }
    // 섹션들
    html += blogPostHtml.sections
      .map(section => {
        let sectionHtml = section.html
        // 관련 링크 추가
        if (section.links && section.links.length > 0) {
          section.links.forEach(linkResult => {
            sectionHtml += `\n<a href="${linkResult.link}" target="_blank" rel="noopener noreferrer" style="display: block; margin: 4px 0; color: #007bff; text-decoration: none; font-size: 14px; padding: 2px 0;">🔗 ${linkResult.name}</a>`
          })
        }
        // 이미지 추가
        if (section.imageUrl) {
          sectionHtml += `\n<img src="${section.imageUrl}" alt="section image" style="width: 100%; height: auto; margin: 10px 0;" />`
        }
        // AI 이미지 프롬프트(디버깅용)
        if (section.aiImagePrompt) {
          sectionHtml += `\n<!-- AI 이미지 프롬프트: ${section.aiImagePrompt} -->`
        }
        return sectionHtml
      })
      .join('\n')
    return html
  }
}
