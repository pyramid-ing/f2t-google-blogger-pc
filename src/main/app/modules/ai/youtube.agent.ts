import { Injectable, Logger } from '@nestjs/common'
import OpenAI from 'openai'

@Injectable()
export class YoutubeAgent {
  private readonly logger = new Logger(YoutubeAgent.name)
  private readonly openai: OpenAI

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }

  async findRelevantVideo(title: string): Promise<string> {
    this.logger.log(`관련 YouTube 영상 검색: ${title}`)

    const prompt = `
주제: ${title}

위 주제와 관련된 YouTube 영상을 찾아주세요.
다음 조건을 만족하는 영상을 선택해주세요:
1. 조회수가 높은 영상
2. 주제와 직접적으로 관련된 내용
3. 교육적이거나 정보성이 높은 영상
4. 최근에 업로드된 영상

영상의 URL만 반환해주세요.
`

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: '당신은 주제와 관련된 최적의 YouTube 영상을 찾아주는 전문가입니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
    })

    const videoUrl = completion.choices[0].message.content.trim()
    if (!videoUrl.includes('youtube.com/watch?v=')) {
      throw new Error('유효하지 않은 YouTube URL입니다.')
    }

    return videoUrl
  }
}
