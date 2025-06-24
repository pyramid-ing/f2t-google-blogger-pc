import { Injectable, Logger } from '@nestjs/common'
import OpenAI from 'openai'

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name)
  private readonly openai: OpenAI

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }

  async generateContent(title: string, description: string): Promise<string> {
    this.logger.log(`컨텐츠 생성 시작: ${title}`)

    const prompt = `
블로그 포스트 제목: ${title}
설명: ${description}

위 주제에 대한 SEO 최적화된 블로그 포스트를 작성해주세요.
다음 요구사항을 반영해주세요:
1. HTML 형식으로 작성 (h1, h2, p 태그 등 사용)
2. 주요 키워드를 자연스럽게 반복
3. 2000-3000자 내외
4. 독자가 이해하기 쉬운 설명 방식
5. 실용적인 예시나 팁 포함
`

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: '당신은 SEO에 최적화된 블로그 포스트를 작성하는 전문가입니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    })

    return completion.choices[0].message.content
  }
}
