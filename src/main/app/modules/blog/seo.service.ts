import { Injectable, Logger } from '@nestjs/common'
import OpenAI from 'openai'

interface SeoMetadata {
  title: string
  content: string
  keywords: string[]
}

interface SeoResult {
  meta: {
    title: string
    description: string
  }
  jsonLd: {
    '@context': 'https://schema.org'
    '@type': 'BlogPosting'
    headline: string
    description: string
    keywords: string[]
    datePublished: string
    author: {
      '@type': 'Person'
      name: string
    }
  }
}

@Injectable()
export class SeoService {
  private readonly logger = new Logger(SeoService.name)
  private readonly openai: OpenAI

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }

  async generateMetadata(data: SeoMetadata): Promise<SeoResult> {
    this.logger.log(`SEO 메타데이터 생성: ${data.title}`)

    const prompt = `
제목: ${data.title}
내용: ${data.content}
키워드: ${data.keywords.join(', ')}

위 블로그 포스트에 대한 SEO 메타데이터를 생성해주세요.
다음 형식으로 반환해주세요:

{
  "meta": {
    "title": "검색 엔진에 최적화된 제목 (60자 이내)",
    "description": "검색 결과에 표시될 설명 (160자 이내)"
  }
}

제목과 설명은 클릭을 유도하면서도 정확한 정보를 전달해야 합니다.
`

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: '당신은 SEO 메타데이터 최적화 전문가입니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json' },
    })

    const meta = JSON.parse(completion.choices[0].message.content)

    // JSON-LD 생성
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: meta.meta.title,
      description: meta.meta.description,
      keywords: data.keywords,
      datePublished: new Date().toISOString(),
      author: {
        '@type': 'Person',
        name: process.env.BLOG_AUTHOR_NAME || '블로그 운영자',
      },
    }

    return {
      meta: meta.meta,
      jsonLd,
    }
  }
}
