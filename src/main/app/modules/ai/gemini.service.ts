import { Injectable, Logger } from '@nestjs/common'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { AIService, ThumbnailData, Topic } from './ai.interface'
import { SettingsService } from '../settings/settings.service'

@Injectable()
export class GeminiService implements AIService {
  private readonly logger = new Logger(GeminiService.name)
  private gemini: GoogleGenerativeAI | null = null

  constructor(private readonly settingsService: SettingsService) {}

  async initialize(): Promise<void> {
    const settings = await this.settingsService.getSettings()
    const apiKey = settings.geminiApiKey

    if (!apiKey) {
      throw new Error('Gemini API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.')
    }

    this.gemini = new GoogleGenerativeAI(apiKey.trim())
  }

  private async getGemini(): Promise<GoogleGenerativeAI> {
    if (!this.gemini) {
      await this.initialize()
    }
    return this.gemini!
  }

  async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string; model?: string }> {
    try {
      const genAI = new GoogleGenerativeAI(apiKey.trim())
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

      // 간단한 프롬프트로 API 키 검증
      await model.generateContent('Hello')

      return {
        valid: true,
        model: 'gemini-pro',
      }
    } catch (error) {
      this.logger.error('Gemini API 키 검증 실패:', error)
      return {
        valid: false,
        error: error.message,
      }
    }
  }

  async generateTopics(topic: string, limit: number): Promise<Topic[]> {
    this.logger.log(`Gemini로 주제 "${topic}"에 대해 ${limit}개의 제목을 생성합니다.`)

    try {
      const genAI = await this.getGemini()
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

      const prompt = `다음 주제에 대해 SEO에 최적화된 블로그 제목 ${limit}개를 생성해주세요.
주제: ${topic}

규칙:
1. 각 제목은 검색 엔진 최적화(SEO)를 고려하여 작성
2. 클릭을 유도하는 매력적인 제목
3. 40-60자 내외로 작성
4. 한글로 작성
5. 숫자나 리스트 형식 선호
6. 각 제목은 새로운 줄에 작성

제목 목록:`

      const result = await model.generateContent(prompt)
      // TODO gemini맞게 수정해야함
      const response = JSON.parse(result.response.text())
      return response.titles || []
    } catch (error) {
      this.logger.error('Gemini API 호출 중 오류 발생:', error)
      throw new Error(`Gemini API 오류: ${error.message}`)
    }
  }

  async generateAiImagePrompt(html: string): Promise<string> {
    try {
      const genAI = await this.getGemini()
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

      const prompt = `다음 HTML 컨텐츠를 분석하여 이미지 생성을 위한 상세한 프롬프트를 작성해주세요.
컨텐츠: ${html}

규칙:
1. 영어로 작성
2. 상세하고 구체적인 설명
3. 이미지 스타일, 구도, 분위기 포함
4. 최대 100단어

프롬프트:`

      const result = await model.generateContent(prompt)
      return result.response.text().trim()
    } catch (error) {
      this.logger.error('이미지 프롬프트 생성 중 오류:', error)
      throw new Error(`Gemini API 오류: ${error.message}`)
    }
  }

  async generatePixabayPrompt(html: string): Promise<string> {
    try {
      const genAI = await this.getGemini()
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

      const prompt = `다음 HTML 컨텐츠를 분석하여 Pixabay 이미지 검색에 사용할 키워드를 추출해주세요.
컨텐츠: ${html}

규칙:
1. 영어로 작성
2. 1-3개의 핵심 키워드만 추출
3. 일반적이고 검색 가능한 단어 사용
4. 쉼표로 구분

키워드:`

      const result = await model.generateContent(prompt)
      return result.response.text().trim()
    } catch (error) {
      this.logger.error('Pixabay 키워드 생성 중 오류:', error)
      throw new Error(`Gemini API 오류: ${error.message}`)
    }
  }

  async generateImage(prompt: string): Promise<string> {
    // Gemini는 현재 이미지 생성을 지원하지 않음
    throw new Error('Gemini는 현재 이미지 생성을 지원하지 않습니다. 다른 서비스를 사용해주세요.')
  }

  async generateThumbnailData(content: string): Promise<ThumbnailData> {
    this.logger.log('Gemini로 썸네일 텍스트 데이터를 생성합니다.')

    try {
      const genAI = await this.getGemini()
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

      const prompt = `다음 컨텐츠를 분석하여 썸네일 이미지에 사용할 텍스트를 생성해주세요.
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
}`

      const result = await model.generateContent(prompt)
      const response = result.response.text()

      try {
        const data = JSON.parse(response)
        return {
          mainText: data.mainText || '',
          subText: data.subText,
          keywords: data.keywords || [],
        }
      } catch (parseError) {
        this.logger.error('JSON 파싱 오류:', parseError)
        // 파싱 실패 시 기본값 반환
        return {
          mainText: response.split('\n')[0] || '',
          keywords: [],
        }
      }
    } catch (error) {
      this.logger.error('썸네일 데이터 생성 중 오류:', error)
      throw new Error(`Gemini API 오류: ${error.message}`)
    }
  }
}
