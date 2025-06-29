import { Injectable, Logger } from '@nestjs/common'
import OpenAI from 'openai'
import { tableOfContentsPrompt, postingContentsPrompt } from 'src/main/app/modules/topic/prompts'
import { SettingsService } from 'src/main/app/modules/settings/settings.service'
import { LinkResult } from './perplexity.service'

export interface Topic {
  title: string
  content: string
}

// Define the TypeScript interface based on the JSON schema
export interface BlogOutline {
  sections: {
    index: number // 섹션 순서
    title: string // 제목
    summary: string // 요약
    length: string // 예상 글자 수 (ex: '250자')
  }[]
}

// Define the TypeScript interface based on the new JSON schema
export interface BlogPostHtml {
  sections: {
    html: string // HTML content for each section
    imageUrl?: string // Optional image URL for each section
    links?: LinkResult[] // Optional related links for each section
    aiImagePrompt?: string // Optional AI image prompt for each section
  }[]
}

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name)

  constructor(private readonly settingsService: SettingsService) {}

  private async getOpenAI(): Promise<OpenAI> {
    const settings = await this.settingsService.getAppSettings()
    const apiKey = settings.openaiApiKey

    if (!apiKey) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.')
    }

    return new OpenAI({
      apiKey,
    })
  }

  /**
   * OpenAI를 사용하여 SEO 최적화된 제목 생성
   */
  async generateSeoTitles(topic: string, limit: number = 3): Promise<Topic[]> {
    this.logger.log(`OpenAI로 주제 "${topic}"에 대해 ${limit}개의 제목을 생성합니다.`)

    const systemPrompt = `
사용자가 구글과 네이버에서 상위노출을 목표로 블로그 글을 작성할 수 있도록 돕는 것입니다.

제목 최적화 지원:
- 사용자가 제시한 대략적인 제목을 기반으로 SEO를 고려한 최적화된 제목 ${limit}가지를 제안
- 검색 의도를 반영하며, 메인 키워드를 자연스럽게 포함
- 제목 길이는 모바일 환경에 적합한 20자 미만 유지

`

    try {
      const openai = await this.getOpenAI()
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `주제: ${topic}`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'seo_titles',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                titles: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: {
                        type: 'string',
                        description: 'SEO 최적화된 제목',
                      },
                      content: {
                        type: 'string',
                        description: '제목에 대한 설명',
                      },
                    },
                    required: ['title', 'content'],
                    additionalProperties: false,
                  },
                  minItems: 1,
                  maxItems: 10,
                },
              },
              required: ['titles'],
              additionalProperties: false,
            },
          },
        },
      })

      const response = JSON.parse(completion.choices[0].message.content)
      return response.titles || []
    } catch (error) {
      this.logger.error('OpenAI API 호출 중 오류 발생:', error)
      throw new Error(`OpenAI API 오류: ${error.message}`)
    }
  }

  /**
   * OpenAI를 사용하여 목차 생성
   */
  async generateBlogOutline(title: string, description: string): Promise<BlogOutline> {
    this.logger.log(`OpenAI로 주제 "${title}"에 대한 목차를 생성합니다.`)

    const systemPrompt = tableOfContentsPrompt

    try {
      const openai = await this.getOpenAI()
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

  /**
   * OpenAI를 사용하여 목차 생성
   */
  async generatePostingContents(blogOutline: BlogOutline): Promise<BlogPostHtml> {
    const systemPrompt = postingContentsPrompt

    try {
      const openai = await this.getOpenAI()
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

      const response: BlogPostHtml = JSON.parse(completion.choices[0].message.content)
      return response
    } catch (error) {
      this.logger.error('OpenAI API 호출 중 오류 발생:', error)
      throw new Error(`OpenAI API 오류: ${error.message}`)
    }
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

  /**
   * HTML 콘텐츠를 분석해서 AI 이미지 생성용 영어 프롬프트 생성
   */
  async generateAiImagePrompt(htmlContent: string): Promise<string> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system' as const,
        content: `
You are an expert in creating detailed image prompts for AI image generation systems like DALL-E.

Read the HTML content provided by the user and create a descriptive English prompt that captures the main theme and visual elements that would best represent the content.

The prompt should be:
- In English only
- Descriptive and visual
- Professional and high-quality style
- Suitable for blog post illustrations
- Include relevant objects, scenes, colors, and mood
- Around 50-100 words maximum
- Focus on creating visually appealing, stock-photo-like images

Example format: "A professional illustration of [main concept], featuring [visual elements], with [color scheme/mood], high quality, clean background, modern style"
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
            name: 'ai_image_prompt',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                imagePrompt: {
                  type: 'string',
                  description: 'AI 이미지 생성을 위한 영어 프롬프트',
                },
              },
              required: ['imagePrompt'],
              additionalProperties: false,
            },
          },
        },
        temperature: 0.7,
      })

      const response = JSON.parse(completion.choices[0].message.content)
      return response.imagePrompt || 'A professional business illustration with modern clean style'
    } catch (error) {
      this.logger.error('AI 이미지 프롬프트 생성 중 오류:', error)
      return 'A professional business illustration with modern clean style' // 기본값 반환
    }
  }

  /**
   * OpenAI DALL-E를 사용하여 이미지 생성
   */
  async generateImage(prompt: string): Promise<string> {
    this.logger.log(`OpenAI DALL-E로 이미지 생성: ${prompt}`)

    try {
      const openai = await this.getOpenAI()
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '512x512',
        quality: 'standard',
        style: 'natural',
      })

      const imageUrl = response.data[0]?.url
      if (!imageUrl) {
        throw new Error('이미지 URL을 받지 못했습니다.')
      }

      this.logger.log(`이미지 생성 완료: ${imageUrl}`)
      return imageUrl
    } catch (error) {
      this.logger.error('OpenAI DALL-E 이미지 생성 중 오류:', error)
      throw new Error(`이미지 생성 오류: ${error.message}`)
    }
  }
}
