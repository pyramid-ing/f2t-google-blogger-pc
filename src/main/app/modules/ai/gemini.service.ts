import { Injectable, Logger } from '@nestjs/common'
import { AIService, BlogOutline, BlogPost, ThumbnailData, Topic } from './ai.interface'
import { SettingsService } from '../settings/settings.service'
import { Type, GoogleGenAI, Modality } from '@google/genai'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { EnvConfig } from '@main/config/env.config'
import { postingContentsPrompt, tableOfContentsPrompt } from '@main/app/modules/ai/prompts'

@Injectable()
export class GeminiService implements AIService {
  private readonly logger = new Logger(GeminiService.name)
  private gemini: GoogleGenAI | null = null

  constructor(private readonly settingsService: SettingsService) {}

  async initialize(): Promise<void> {
    const settings = await this.settingsService.getSettings()
    const apiKey = settings.geminiApiKey

    if (!apiKey) {
      throw new Error('Gemini API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.')
    }

    this.gemini = new GoogleGenAI({ apiKey: apiKey.trim() })
  }

  private async getGemini(): Promise<GoogleGenAI> {
    const settings = await this.settingsService.getSettings()
    const apiKey = settings.geminiApiKey

    if (!apiKey) {
      throw new Error('Gemini API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.')
    }

    return new GoogleGenAI({ apiKey: apiKey.trim() })
  }

  async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string; model?: string }> {
    try {
      const genAI = new GoogleGenAI({ apiKey: apiKey.trim() })
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: 'hello',
        config: {
          maxOutputTokens: 10,
        },
      })
      const response = result.text

      if (!response) {
        throw new Error('API 응답이 비어있습니다.')
      }

      return {
        valid: true,
        model: 'gemini-2.5-pro',
      }
    } catch (error) {
      this.logger.error('Gemini API 키 검증 실패:', error)

      // 에러 메시지 가공
      let errorMessage = '알 수 없는 오류가 발생했습니다.'

      if (error.message?.includes('API key not valid')) {
        errorMessage = 'API 키가 유효하지 않습니다. 올바른 API 키를 입력해주세요.'
      } else if (error.message?.includes('quota')) {
        errorMessage = 'API 할당량이 초과되었습니다. 나중에 다시 시도해주세요.'
      } else if (error.message?.includes('permission')) {
        errorMessage = 'API 키에 필요한 권한이 없습니다.'
      } else if (error.message?.includes('not found')) {
        errorMessage = 'API 버전 또는 모델이 올바르지 않습니다. Gemini API가 활성화되어 있는지 확인해주세요.'
      }

      return {
        valid: false,
        error: errorMessage,
      }
    }
  }

  async generateTopics(topic: string, limit: number): Promise<Topic[]> {
    this.logger.log(`Gemini로 주제 "${topic}"에 대해 ${limit}개의 제목을 생성합니다.`)

    try {
      const prompt = `다음 주제에 대해 SEO에 최적화된 블로그 제목 ${limit}개를 생성해주세요.
주제: ${topic}

규칙:
1. 각 제목은 검색 엔진 최적화(SEO)를 고려하여 작성
2. 클릭을 유도하는 매력적인 제목
3. 40-60자 내외로 작성
4. 한글로 작성
5. 숫자나 리스트 형식 선호
6. 각 제목은 새로운 줄에 작성

응답 형식:
{
  "titles": [
    {
      "title": "제목1",
      "content": "내용1"
    }
    // ... 추가 제목들
  ]
}

제목 목록:`

      const genAI = await this.getGemini()
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              titles: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    content: { type: Type.STRING },
                  },
                  required: ['title', 'content'],
                },
              },
            },
            required: ['titles'],
            propertyOrdering: ['titles'],
          },
        },
      })

      const res = JSON.parse(result.text)

      return res.titles || []
    } catch (error) {
      this.logger.error('Gemini API 호출 중 오류 발생:', error)
      if (error.message?.includes('not found')) {
        throw new Error(
          'Gemini API가 활성화되어 있지 않거나, API 버전이 올바르지 않습니다. Google Cloud Console에서 Gemini API를 활성화해주세요.',
        )
      }
      throw new Error(`Gemini API 오류: ${error.message}`)
    }
  }

  async generateBlogOutline(title: string, description: string): Promise<BlogOutline> {
    this.logger.log(`Gemini로 주제 "${title}"에 대한 목차를 생성합니다.`)

    const prompt = `${tableOfContentsPrompt}
[user]
title: ${title}
description: ${description}`

    try {
      const ai = await this.getGemini() // GoogleGenAI 인스턴스

      const resp = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          responseMimeType: 'application/json', // JSON 출력 강제 :contentReference[oaicite:2]{index=2}
          maxOutputTokens: 60000,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    index: { type: Type.NUMBER },
                    title: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    length: { type: Type.STRING },
                  },
                  required: ['index', 'title', 'summary', 'length'],
                },
                minItems: 1,
              },
            },
            required: ['sections'],
          },
        },
      })

      const parsed = JSON.parse(resp.text) as BlogOutline
      return parsed
    } catch (error) {
      this.logger.error('Gemini API 호출 중 오류 발생:', error)
      throw new Error(`Gemini API 오류: ${error.message}`)
    }
  }

  async generateBlogPost(blogOutline: BlogOutline): Promise<BlogPost> {
    this.logger.log(`Gemini로 블로그 콘텐츠 생성 시작`)

    const prompt = `${postingContentsPrompt}
[콘텐츠 아웃라인:]
${JSON.stringify(blogOutline)}`

    try {
      const ai = await this.getGemini()

      const resp = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          maxOutputTokens: 60000,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    html: { type: Type.STRING },
                  },
                  required: ['html'],
                },
                minItems: 1,
              },
            },
            required: ['sections'],
            propertyOrdering: ['sections'],
          },
        },
      })

      const result = JSON.parse(resp.text) as BlogPost
      return result
    } catch (error: any) {
      this.logger.error('Gemini API 호출 오류:', error)
      throw new Error(`Gemini API 오류: ${error.message}`)
    }
  }

  async generatePixabayPrompt(html: string): Promise<string> {
    try {
      const prompt = `다음 HTML 컨텐츠를 분석하여 이미지 검색에 사용할 키워드를 생성해주세요.
컨텐츠: ${html}

규칙:
1. 한글 키워드
2. 명사 위주
3. 2-3개의 단어로 구성
4. 구체적이고 검색 가능한 단어 선택

키워드:`

      const genAI = await this.getGemini()
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {},
      })

      return result.text
    } catch (error) {
      this.logger.error('Pixabay 키워드 생성 중 오류:', error)
      throw new Error(`Gemini API 오류: ${error.message}`)
    }
  }

  async generateAiImagePrompt(html: string): Promise<string> {
    try {
      const prompt = `다음 HTML 컨텐츠를 분석하여 이미지 생성을 위한 상세한 프롬프트를 작성해주세요.
컨텐츠: ${html}

규칙:
1. 영어 프롬프트로 출력
2. 하지만 독자는 한국인이므로 한국인이 이해가능한 이미지(절대 한글로 글자 적지마.(깨짐 문제))
2. 상세하고 구체적인 설명
3. 이미지 스타일, 구도, 분위기 포함
4. 최대 100단어

프롬프트:`

      const genAI = await this.getGemini()
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {},
      })
      return result.text
    } catch (error) {
      this.logger.error('이미지 프롬프트 생성 중 오류:', error)
      throw new Error(`Gemini API 오류: ${error.message}`)
    }
  }

  /**
   * Gemini를 사용하여 이미지 생성
   */
  async generateImage(prompt: string): Promise<string> {
    this.logger.log(`Gemini로 이미지 생성: ${prompt}`)
    let tempFilePath: string | undefined

    try {
      const ai = await this.getGemini()

      // temp 디렉토리가 없으면 생성
      if (!fs.existsSync(EnvConfig.tempDir)) {
        fs.mkdirSync(EnvConfig.tempDir, { recursive: true })
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-preview-image-generation',
        contents: prompt,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      })

      const parts = response.candidates[0].content.parts

      // 텍스트 설명 + 이미지 저장
      for (const part of parts) {
        if (part.inlineData?.data) {
          const buffer = Buffer.from(part.inlineData.data, 'base64')
          const fileName = `output-${Date.now()}.png`
          tempFilePath = path.join(EnvConfig.tempDir, fileName)
          fs.writeFileSync(tempFilePath, buffer)

          return tempFilePath // 로컬 파일 경로 반환
        }
      }

      throw new Error('이미지 데이터를 받지 못했습니다.')
    } catch (error) {
      this.logger.error('Gemini 이미지 생성 중 오류:', error)
      throw error
    }
  }

  async generateThumbnailData(content: string): Promise<ThumbnailData> {
    this.logger.log('Gemini로 썸네일 텍스트 데이터를 생성합니다.')

    try {
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

      const genAI = await this.getGemini()
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          responseMimeType: 'application/json', // JSON 출력 필수
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mainText: { type: Type.STRING },
              subText: { type: Type.STRING },
              keywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['mainText', 'subText', 'keywords'],
            propertyOrdering: ['mainText', 'subText', 'keywords'],
          },
        },
      })
      try {
        const data = JSON.parse(result.text)
        return {
          mainText: data.mainText || '',
          subText: data.subText,
          keywords: data.keywords || [],
        }
      } catch (parseError) {
        this.logger.error('JSON 파싱 오류:', parseError)
        // 파싱 실패 시 기본값 반환
        return {
          mainText: result.text.split('\n')[0] || '',
          keywords: [],
        }
      }
    } catch (error) {
      this.logger.error('썸네일 데이터 생성 중 오류:', error)
      throw new Error(`Gemini API 오류: ${error.message}`)
    }
  }
}
