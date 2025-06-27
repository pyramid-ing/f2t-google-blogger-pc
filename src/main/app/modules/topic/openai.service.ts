import { Injectable, Logger } from '@nestjs/common'
import OpenAI from 'openai'
import { tableOfContentsPrompt, postingContentsPrompt } from './prompts'

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
  }[]
}

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name)
  private readonly openai: OpenAI

  constructor() {
    this.openai = new OpenAI({
      apiKey:
        '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',
    })
  }

  /**
   * OpenAI를 사용하여 SEO 최적화된 제목 생성
   */
  async generateSeoTitles(topic: string, limit: number = 3): Promise<Topic[]> {
    this.logger.log(`OpenAI로 주제 "${topic}"에 대해 ${limit}개의 제목을 생성합니다.`)

    const prompt = `
사용자가 구글과 네이버에서 상위노출을 목표로 블로그 글을 작성할 수 있도록 돕는 것입니다.

제목 최적화 지원:
- 사용자가 제시한 대략적인 제목을 기반으로 SEO를 고려한 최적화된 제목 ${limit}가지를 제안
- 검색 의도를 반영하며, 메인 키워드를 자연스럽게 포함
- 제목 길이는 모바일 환경에 적합한 20자 미만 유지

주제: ${topic}

응답 형식:
[
  {
    "title": "제목",
    "content": "제목에 대한 설명"
  }
]
`

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              '당신은 SEO 전문가입니다. 사용자의 주제에 맞는 최적화된 제목을 JSON 형식으로 제안해주세요. 예: { "titles": ["제목1", "제목2", "제목3"] }',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
      })

      const response = JSON.parse(completion.choices[0].message.content)
      return response.map(item => ({ title: item.title, content: item.content })) || []
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
      const completion = await this.openai.chat.completions.create({
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
      const completion = await this.openai.chat.completions.create({
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
}
