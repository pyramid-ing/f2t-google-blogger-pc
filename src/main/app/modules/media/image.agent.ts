import { Injectable, Logger } from '@nestjs/common'
import OpenAI from 'openai'
import axios from 'axios'

@Injectable()
export class ImageAgent {
  private readonly logger = new Logger(ImageAgent.name)
  private readonly openai: OpenAI
  private readonly pixabayApiKey = process.env.PIXABAY_API_KEY

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }

  async extractKeyword(content: string): Promise<string> {
    this.logger.log('컨텐츠에서 이미지 키워드 추출')

    const prompt = `
다음 블로그 포스트 내용을 분석하고, 포스트를 대표할 수 있는 이미지 검색 키워드를 추출해주세요.
키워드는 영어로 작성해주세요.

내용:
${content}

키워드만 반환해주세요.
`

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: '당신은 텍스트 컨텐츠를 분석하여 적절한 이미지 검색 키워드를 추출하는 전문가입니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
    })

    return completion.choices[0].message.content.trim()
  }

  async searchImage(keyword: string): Promise<string> {
    this.logger.log(`이미지 검색: ${keyword}`)

    const response = await axios.get('https://pixabay.com/api/', {
      params: {
        key: this.pixabayApiKey,
        q: keyword,
        image_type: 'photo',
        orientation: 'horizontal',
        safesearch: true,
        per_page: 3,
      },
    })

    if (!response.data.hits?.length) {
      throw new Error(`이미지를 찾을 수 없습니다: ${keyword}`)
    }

    // 첫 번째 이미지의 URL 반환
    return response.data.hits[0].largeImageURL
  }
}
