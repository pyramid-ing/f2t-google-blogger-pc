import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { LinkResult, PerplexityService, YoutubeResult } from '../ai/perplexity.service'
import { ImagePixabayService } from '../media/image-pixabay.service'
import { SettingsService } from '../settings/settings.service'
import { JobLogsService } from '../job-logs/job-logs.service'
import axios from 'axios'
import sharp from 'sharp'
import { StorageService } from '@main/app/modules/google/storage/storage.service'
import Bottleneck from 'bottleneck'
import { sleep } from '@main/app/utils/sleep'
import { AIService, BlogOutline, BlogPost } from '@main/app/modules/ai/ai.interface'
import { AIFactory } from '@main/app/modules/ai/ai.factory'
import * as fs from 'fs'
import * as path from 'path'
import { EnvConfig } from '@main/config/env.config'
import { UtilService } from '../util/util.service'

export interface SectionContent {
  html: string
  imageUrl?: string
  adHtml?: string
  links?: LinkResult[]
  youtubeLinks?: YoutubeResult[]
}

export interface ProcessedSection extends SectionContent {
  sectionIndex: number
}

@Injectable()
export class ContentGenerateService implements OnModuleInit {
  private readonly logger = new Logger(ContentGenerateService.name)
  private imageGenerationLimiter: Bottleneck

  constructor(
    private readonly aiFactory: AIFactory,
    private readonly perplexityService: PerplexityService,
    private readonly imagePixabayService: ImagePixabayService,
    private readonly storageService: StorageService,
    private readonly settingsService: SettingsService,
    private readonly jobLogsService: JobLogsService,
    private readonly utilService: UtilService,
  ) {
    this.imageGenerationLimiter = new Bottleneck({
      maxConcurrent: 3,
      minTime: 1000,
    })
  }

  async onModuleInit() {
    try {
      const files = fs.readdirSync(EnvConfig.tempDir)
      for (const file of files) {
        const filePath = path.join(EnvConfig.tempDir, file)
        fs.unlinkSync(filePath)
      }
      this.logger.log('temp 디렉토리 초기화 완료')
    } catch (error) {
      this.logger.error('temp 디렉토리 초기화 중 오류:', error)
    }
  }

  private async getAIService(): Promise<AIService> {
    const aiService = await this.aiFactory.getAIService()
    await aiService.initialize()
    return aiService
  }

  async generate(title: string, desc: string, jobId?: string): Promise<string> {
    if (jobId) {
      await this.jobLogsService.createJobLog(jobId, '컨텐츠 생성 작업 시작')
    }

    try {
      const aiService = await this.getAIService()

      // 1. 블로그 아웃라인 생성
      if (jobId) {
        await this.jobLogsService.createJobLog(jobId, '블로그 목차 생성 시작')
      }
      const blogOutline = await this.generateBlogOutline(title, desc, aiService)
      if (jobId) {
        await this.jobLogsService.createJobLog(jobId, '블로그 목차 생성 완료')
      }

      // 2. 블로그 포스트 생성
      if (jobId) {
        await this.jobLogsService.createJobLog(jobId, '블로그 포스트 생성 시작')
      }
      const blogPost = await this.generateBlogPost(blogOutline, aiService)
      if (jobId) {
        await this.jobLogsService.createJobLog(jobId, '블로그 포스트 생성 완료')
      }

      // 3. 이미지, 링크, 광고 등 섹션별 처리
      if (jobId) {
        await this.jobLogsService.createJobLog(jobId, '섹션별 추가 컨텐츠 처리 시작')
      }

      const processedSections: ProcessedSection[] = await Promise.all(
        blogPost.sections.map(async (section: SectionContent, sectionIndex: number) => {
          try {
            const [imageUrl, links, youtubeLinks, adHtml] = await Promise.all([
              this.generateAndUploadImage(section.html, sectionIndex, jobId, aiService),
              this.generateLinks(section.html, sectionIndex, jobId),
              this.generateYoutubeLinks(section.html, sectionIndex, jobId),
              this.generateAdScript(sectionIndex),
            ])
            return {
              ...section,
              sectionIndex,
              imageUrl,
              links,
              youtubeLinks,
              adHtml,
            }
          } catch (error) {
            if (jobId) {
              await this.jobLogsService.createJobLog(
                jobId,
                `섹션 ${sectionIndex} 처리 중 오류: ${error.message}`,
                'error',
              )
            }
            throw error
          }
        }),
      )

      // 섹션 순서 유지를 위해 정렬
      processedSections.sort((a, b) => a.sectionIndex - b.sectionIndex)

      if (jobId) {
        await this.jobLogsService.createJobLog(jobId, '섹션별 추가 컨텐츠 처리 완료')
      }

      // SEO 정보 생성
      const allSectionsHtml = processedSections.map(s => s.html).join('\n')
      const seo = await this.generateSeo(allSectionsHtml, 0)

      // 썸네일 이미지 생성
      if (jobId) {
        await this.jobLogsService.createJobLog(jobId, '썸네일 이미지 생성 시작')
      }
      const thumbnailUrl = await this.generateThumbnailImage(title)
      if (jobId) {
        await this.jobLogsService.createJobLog(
          jobId,
          thumbnailUrl ? '썸네일 이미지 생성 완료' : '썸네일 이미지 생성 건너뜀',
        )
      }

      // BlogPost 객체 생성
      const blogPostWithMeta: BlogPost = {
        thumbnailUrl,
        seo,
        sections: processedSections.map(({ sectionIndex, adHtml, ...rest }) => rest),
      }

      // HTML 결합
      const combinedHtml = this.combineHtmlSections(blogPostWithMeta)

      if (jobId) {
        await this.jobLogsService.createJobLog(jobId, '컨텐츠 생성 작업 완료')
      }

      return combinedHtml
    } catch (error) {
      if (jobId) {
        await this.jobLogsService.createJobLog(jobId, `컨텐츠 생성 실패: ${error.message}`, 'error')
      }
      throw error
    }
  }

  /**
   * 링크 생성을 처리하는 메서드
   */
  private async generateLinks(html: string, sectionIndex: number, jobId?: string): Promise<LinkResult[]> {
    try {
      const settings = await this.settingsService.getSettings()

      // 링크 생성이 비활성화되어 있으면 빈 배열 반환
      if (!settings.linkEnabled) {
        return []
      }

      if (jobId) {
        await this.jobLogsService.createJobLog(jobId, `섹션 ${sectionIndex} 관련 링크 생성 시작`)
      }

      // 설정된 링크 수만큼만 생성
      const links = await this.perplexityService.generateRelevantLinks(html)

      if (jobId) {
        await this.jobLogsService.createJobLog(jobId, `섹션 ${sectionIndex} 관련 링크 ${links.length}개 생성 완료`)
      }
      return links
    } catch (error) {
      if (jobId) {
        await this.jobLogsService.createJobLog(jobId, `섹션 ${sectionIndex} 링크 생성 실패: ${error.message}`, 'error')
      }
      return []
    }
  }

  /**
   * 유튜브 링크 생성을 처리하는 메서드
   */
  private async generateYoutubeLinks(html: string, sectionIndex: number, jobId?: string): Promise<YoutubeResult[]> {
    try {
      const settings = await this.settingsService.getSettings()

      // 유튜브 링크 생성이 비활성화되어 있으면 빈 배열 반환
      if (!settings.youtubeEnabled) {
        return []
      }

      if (jobId) {
        await this.jobLogsService.createJobLog(jobId, `섹션 ${sectionIndex} 관련 유튜브 링크 생성 시작`)
      }

      // 유튜브 링크 생성
      const youtubeLinks = await this.perplexityService.generateYoutubeLinks(html)

      if (jobId) {
        await this.jobLogsService.createJobLog(
          jobId,
          `섹션 ${sectionIndex} 관련 유튜브 링크 ${youtubeLinks.length}개 생성 완료`,
        )
      }
      return youtubeLinks
    } catch (error) {
      if (jobId) {
        await this.jobLogsService.createJobLog(
          jobId,
          `섹션 ${sectionIndex} 유튜브 링크 생성 실패: ${error.message}`,
          'error',
        )
      }
      return []
    }
  }

  /**
   * SEO 정보를 생성하는 메서드
   */
  private async generateSeo(html: string, sectionIndex: number): Promise<string> {
    try {
      return ''
    } catch (error) {
      this.logger.warn(`섹션 ${sectionIndex} SEO 처리 중 오류: ${error.message}`)
      return ''
    }
  }

  /**
   * 썸네일 이미지를 생성하는 함수
   */
  async generateThumbnailImage(title: string, subtitle?: string): Promise<string | undefined> {
    try {
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
  private async generateAndUploadImage(
    html: string,
    sectionIndex: number,
    jobId?: string,
    aiService?: AIService,
  ): Promise<string | undefined> {
    try {
      const settings = await this.settingsService.getSettings()
      const imageType = settings.imageType || 'none'
      const currentAiService = aiService || (await this.getAIService())

      let imageUrl: string | undefined

      if (imageType === 'pixabay') {
        try {
          if (jobId) {
            await this.jobLogsService.createJobLog(jobId, `섹션 ${sectionIndex} Pixabay 이미지 검색 시작`)
          }
          const pixabayKeyword = await currentAiService.generatePixabayPrompt(html)
          imageUrl = await this.imagePixabayService.searchImage(pixabayKeyword)
          if (jobId) {
            await this.jobLogsService.createJobLog(jobId, `섹션 ${sectionIndex} Pixabay 이미지 검색 완료`)
          }
        } catch (error) {
          if (jobId) {
            await this.jobLogsService.createJobLog(
              jobId,
              `섹션 ${sectionIndex} Pixabay 이미지 검색 실패: ${error.message}`,
              'error',
            )
          }
          return undefined
        }
      } else if (imageType === 'ai') {
        try {
          if (jobId) {
            await this.jobLogsService.createJobLog(jobId, `섹션 ${sectionIndex} AI 이미지 생성 시작`)
          }

          const aiImagePrompt = await currentAiService.generateAiImagePrompt(html)

          const generateWithRetry = async (retries = 6, initialDelay = 1000) => {
            let lastError: any = null

            for (let i = 0; i < retries; i++) {
              try {
                return await this.imageGenerationLimiter.schedule(async () => {
                  const result = await currentAiService.generateImage(aiImagePrompt)
                  return result
                })
              } catch (error) {
                lastError = error
                const isRateLimitError = error?.stack?.[0]?.status === 429 || error?.status === 429

                if (i < retries - 1) {
                  const jitter = Math.random() * 0.3
                  const backoffDelay = Math.min(initialDelay * Math.pow(2, i) * (1 + jitter), 60000)

                  if (jobId) {
                    await this.jobLogsService.createJobLog(
                      jobId,
                      `섹션 ${sectionIndex} AI 이미지 생성 ${isRateLimitError ? 'rate limit으로 인해' : '오류로 인해'} ${Math.round(backoffDelay / 1000)}초 후 재시도... (${i + 1}/${retries})`,
                    )
                  }
                  await sleep(backoffDelay)
                  continue
                }
                throw lastError
              }
            }
            throw lastError || new Error('최대 재시도 횟수 초과')
          }

          imageUrl = await generateWithRetry()

          if (jobId) {
            await this.jobLogsService.createJobLog(jobId, `섹션 ${sectionIndex} AI 이미지 생성 완료`)
          }
        } catch (error) {
          if (jobId) {
            await this.jobLogsService.createJobLog(
              jobId,
              `섹션 ${sectionIndex} AI 이미지 생성 실패: ${error.message}`,
              'error',
            )
          }
          this.logger.error(`섹션 ${sectionIndex} AI 이미지 생성 실패:`, error)
          return undefined
        }
      } else {
        this.logger.log(`섹션 ${sectionIndex}: 이미지 사용 안함 설정`)
        return undefined
      }

      // 공통: 이미지 다운로드 및 업로드
      if (imageUrl) {
        try {
          if (jobId) {
            await this.jobLogsService.createJobLog(jobId, `섹션 ${sectionIndex} 이미지 최적화 및 업로드 시작`)
          }

          let imageBuffer: Buffer
          // 로컬 파일 경로인 경우
          if (this.utilService.isLocalPath(imageUrl)) {
            const normalizedPath = path.normalize(imageUrl)
            imageBuffer = fs.readFileSync(normalizedPath)
          } else {
            // 원격 URL인 경우
            const response = await axios.get(imageUrl, {
              responseType: 'arraybuffer',
              timeout: 30000,
            })
            imageBuffer = Buffer.from(response.data)
          }

          const optimizedBuffer = await this.optimizeImage(imageBuffer)

          const uploadResult = await this.storageService.uploadImage(optimizedBuffer, {
            contentType: 'image/webp',
          })

          if (jobId) {
            await this.jobLogsService.createJobLog(jobId, `섹션 ${sectionIndex} 이미지 업로드 완료`)
          }
          return uploadResult.url
        } catch (uploadError) {
          if (jobId) {
            await this.jobLogsService.createJobLog(
              jobId,
              `섹션 ${sectionIndex} 이미지 업로드 실패: ${uploadError.message}`,
              'error',
            )
          }
          return imageUrl
        }
      }
      return undefined
    } catch (error) {
      if (jobId) {
        await this.jobLogsService.createJobLog(
          jobId,
          `섹션 ${sectionIndex} 이미지 처리 실패: ${error.message}`,
          'error',
        )
      }
      return undefined
    }
  }

  /**
   * 설정에 따라 광고 스크립트를 삽입하는 함수
   */
  private async generateAdScript(sectionIndex: number): Promise<string | undefined> {
    try {
      const settings = await this.settingsService.getSettings()
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
   * AI 서비스를 사용하여 목차 생성
   */
  async generateBlogOutline(title: string, description: string, aiService?: AIService): Promise<BlogOutline> {
    this.logger.log(`AI 서비스로 주제 "${title}"에 대한 목차를 생성합니다.`)

    const currentAiService = aiService || (await this.getAIService())

    try {
      const blogOutline = await currentAiService.generateBlogOutline(title, description)

      return blogOutline
    } catch (error) {
      this.logger.error('AI API 호출 중 오류 발생:', error)
      throw new Error(`AI API 오류: ${error.message}`)
    }
  }

  async generateBlogPost(blogOutline: BlogOutline, aiService?: AIService): Promise<BlogPost> {
    const currentAiService = aiService || (await this.getAIService())

    try {
      const blogPost = await currentAiService.generateBlogPost(blogOutline)

      return blogPost
    } catch (error) {
      this.logger.error('AI API 호출 중 오류 발생:', error)
      throw new Error(`AI API 오류: ${error.message}`)
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
        // 유튜브 링크 임베딩 추가
        if (section.youtubeLinks && section.youtubeLinks.length > 0) {
          section.youtubeLinks.forEach(youtube => {
            sectionHtml += `
            <div class="youtube-embed" style="margin: 20px 0; text-align: center;">
                <iframe width="560" height="315" src="https://www.youtube.com/embed/${youtube.videoId}" 
                title="YouTube video player" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                referrerpolicy="strict-origin-when-cross-origin" 
                allowfullscreen></iframe>
            </div>`
          })
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
