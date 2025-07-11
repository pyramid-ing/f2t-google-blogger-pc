import { Injectable, Logger } from '@nestjs/common'
import OpenAI from 'openai'
import { SettingsService } from '../settings/settings.service'
import { AIService, BlogOutline, BlogPost, ThumbnailData, Topic } from './ai.interface'
import { postingContentsPrompt, tableOfContentsPrompt } from '@main/app/modules/ai/prompts'

@Injectable()
export class OpenAiService implements AIService {
  private readonly logger = new Logger(OpenAiService.name)
  private openai: OpenAI | null = null

  constructor(private readonly settingsService: SettingsService) {}

  async initialize(): Promise<void> {
    const settings = await this.settingsService.getSettings()
    const apiKey = settings.openaiApiKey

    if (!apiKey) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.')
    }

    this.openai = new OpenAI({ apiKey: apiKey.trim() })
  }

  public async getOpenAI(): Promise<OpenAI> {
    if (!this.openai) {
      await this.initialize()
    }
    return this.openai!
  }

  async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string; model?: string }> {
    try {
      const openai = new OpenAI({ apiKey: apiKey.trim() })
      const models = await openai.models.list()
      const hasGpt35 = models.data.some(model => model.id === 'gpt-3.5-turbo')

      if (!hasGpt35) {
        return {
          valid: false,
          error: 'API 키가 유효하지만 필요한 모델(gpt-3.5-turbo)에 접근할 수 없습니다.',
        }
      }

      return {
        valid: true,
        model: 'gpt-3.5-turbo',
      }
    } catch (error) {
      this.logger.error('OpenAI API 키 검증 실패:', error)

      // 에러 메시지 가공
      let errorMessage = '알 수 없는 오류가 발생했습니다.'

      if (error.message?.includes('Incorrect API key')) {
        errorMessage = 'API 키가 유효하지 않습니다. 올바른 API 키를 입력해주세요.'
      } else if (error.message?.includes('Rate limit')) {
        errorMessage = 'API 할당량이 초과되었습니다. 나중에 다시 시도해주세요.'
      } else if (error.message?.includes('insufficient_quota')) {
        errorMessage = '계정의 할당량이 부족합니다. 결제 상태를 확인해주세요.'
      } else if (error.message?.includes('access_denied')) {
        errorMessage = 'API 키에 필요한 권한이 없습니다.'
      }

      return {
        valid: false,
        error: errorMessage,
      }
    }
  }

  /**
   * OpenAI를 사용하여 SEO 최적화된 제목 생성
   */
  async generateTopics(topic: string, limit: number): Promise<Topic[]> {
    this.logger.log(`OpenAI로 주제 "${topic}"에 대해 ${limit}개의 제목을 생성합니다.`)

    try {
      const openai = await this.getOpenAI()
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: '당신은 SEO에 최적화된 블로그 제목을 생성하는 전문가입니다.',
          },
          {
            role: 'user',
            content: `다음 주제에 대해 SEO에 최적화된 블로그 제목 ${limit}개를 생성해주세요.
주제: ${topic}

규칙:
1. 각 제목은 검색 엔진 최적화(SEO)를 고려하여 작성
2. 클릭을 유도하는 매력적인 제목
3. 40-60자 내외로 작성
4. 한글로 작성
5. 숫자나 리스트 형식 선호
6. 각 제목은 새로운 줄에 작성

제목 목록:`,
          },
        ],
        temperature: 0.7,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'titlesResponse',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                titles: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      content: { type: 'string' },
                    },
                    required: ['title', 'content'],
                    additionalProperties: false,
                  },
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
   * HTML 컨텐츠에서 Pixabay 이미지 검색용 키워드 생성
   */
  async generatePixabayPrompt(html: string): Promise<string[]> {
    try {
      const openai = await this.getOpenAI()
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: '당신은 HTML 컨텐츠를 분석하여 이미지 검색에 적합한 키워드를 추출하는 전문가입니다.',
          },
          {
            role: 'user',
            content: `다음 HTML 컨텐츠를 분석하여 Pixabay 이미지 검색에 사용할 키워드를 추출해주세요.
컨텐츠: ${html}

규칙:
1. 한글 키워드
2. 명사 위주
3. 5개의 키워드 생성
4. 구체적이고 검색 가능한 단어 선택
5. 가장 관련성 높은 순서대로 정렬
6. 각 키워드는 2-3개의 단어로 구성

응답 형식:
{
  "keywords": [
    "키워드1",
    "키워드2",
    "키워드3",
    "키워드4",
    "키워드5"
  ]
}`,
          },
        ],
        temperature: 0.7,
        response_format: {
          type: 'json_object',
        },
      })

      const response = JSON.parse(completion.choices[0].message.content || '{}')
      return response.keywords || []
    } catch (error) {
      this.logger.error('Pixabay 키워드 생성 중 오류:', error)
      throw new Error(`OpenAI API 오류: ${error.message}`)
    }
  }

  /**
   * HTML 콘텐츠를 분석해서 AI 이미지 생성용 영어 프롬프트 생성
   */
  async generateAiImagePrompt(html: string): Promise<string> {
    try {
      const openai = await this.getOpenAI()
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: '당신은 HTML 컨텐츠를 분석하여 이미지 생성을 위한 상세한 프롬프트를 작성하는 전문가입니다.',
          },
          {
            role: 'user',
            content: `다음 HTML 컨텐츠를 분석하여 이미지 생성을 위한 상세한 프롬프트를 작성해주세요.
컨텐츠: ${html}

규칙:
1. 영어로 작성
2. 상세하고 구체적인 설명
3. 이미지 스타일, 구도, 분위기 포함
4. 최대 100단어

프롬프트:`,
          },
        ],
        temperature: 0.7,
      })

      return completion.choices[0].message.content?.trim() || ''
    } catch (error) {
      this.logger.error('이미지 프롬프트 생성 중 오류:', error)
      throw new Error(`OpenAI API 오류: ${error.message}`)
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
        size: '1024x1024',
        quality: 'standard',
        response_format: 'url',
      })

      if (!response.data[0]?.url) {
        throw new Error('이미지 URL을 받지 못했습니다.')
      }

      return response.data[0].url
    } catch (error) {
      this.logger.error('OpenAI DALL-E 이미지 생성 중 오류:', error)
      throw error
    }
  }
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

  async generateBlogPost(blogOutline: BlogOutline): Promise<BlogPost> {
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

      const response: BlogPost = JSON.parse(completion.choices[0].message.content)
      return response
    } catch (error) {
      this.logger.error('OpenAI API 호출 중 오류 발생:', error)
      throw new Error(`OpenAI API 오류: ${error.message}`)
    }
  }
  /**
   * HTML 컨텐츠를 분석하여 썸네일용 제목과 부제목 생성
   */
  async generateThumbnailData(content: string): Promise<ThumbnailData> {
    this.logger.log('OpenAI로 썸네일 텍스트 데이터를 생성합니다.')

    try {
      const openai = await this.getOpenAI()
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: '당신은 컨텐츠를 분석하여 썸네일 이미지에 사용할 텍스트를 생성하는 전문가입니다.',
          },
          {
            role: 'user',
            content: `다음 컨텐츠를 분석하여 썸네일 이미지에 사용할 텍스트를 생성해주세요.
컨텐츠: ${content}

규칙:
1. 메인 텍스트는 짧고 강력한 메시지 (최대 20자)
2. 서브 텍스트는 부가 설명 (최대 30자, 선택사항)
3. 키워드는 3-5개의 핵심 단어
4. JSON 형식으로 응답

예시 응답:
{
  "mainText": "메인 텍스트",
  "subText": "서브 텍스트",
  "keywords": ["키워드1", "키워드2", "키워드3"]
}`,
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      })

      const result = JSON.parse(completion.choices[0].message.content || '{}')
      return {
        mainText: result.mainText || '',
        subText: result.subText,
        keywords: result.keywords || [],
      }
    } catch (error) {
      this.logger.error('썸네일 데이터 생성 중 오류:', error)
      throw new Error(`OpenAI API 오류: ${error.message}`)
    }
  }
}
