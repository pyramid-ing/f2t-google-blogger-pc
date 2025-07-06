import { Injectable, Logger } from '@nestjs/common'
import OpenAI from 'openai'
import { SettingsService } from '../settings/settings.service'
import { AIService, ThumbnailData, Topic } from './ai.interface'

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
      return {
        valid: false,
        error: error.message,
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
        model: 'gpt-3.5-turbo',
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
  async generatePixabayPrompt(html: string): Promise<string> {
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
1. 영어로 작성
2. 1-3개의 핵심 키워드만 추출
3. 일반적이고 검색 가능한 단어 사용
4. 쉼표로 구분

키워드:`,
          },
        ],
        temperature: 0.7,
      })

      return completion.choices[0].message.content?.trim() || ''
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
