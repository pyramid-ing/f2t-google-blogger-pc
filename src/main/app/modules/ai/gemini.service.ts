import { Injectable, Logger } from '@nestjs/common'
import { AIService, BlogOutline, BlogPost, ThumbnailData, Topic, GeminiQuotaError } from './ai.interface'
import { SettingsService } from '../settings/settings.service'
import { Type, GoogleGenAI, Modality } from '@google/genai'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { EnvConfig } from '@main/config/env.config'
import { postingContentsPrompt, tableOfContentsPrompt } from '@main/app/modules/ai/prompts'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

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
    // 길이 체크: Gemini API 키는 일반적으로 32~128자 내외
    if (!apiKey || apiKey.trim().length < 32 || apiKey.trim().length > 128) {
      throw new CustomHttpException(ErrorCode.AI_KEY_INVALID, {
        reason: 'API 키 길이가 올바르지 않습니다. 올바른 길이의 키를 입력해주세요.',
        length: apiKey?.length,
      })
    }
    try {
      const genAI = new GoogleGenAI({ apiKey: apiKey.trim() })
      const result = await genAI.models.generateContent({
        model: 'gemini-1.5-pro',
        contents: 'hello',
        config: {
          maxOutputTokens: 10,
        },
      })
      const response = result.text

      if (!response) {
        throw new CustomHttpException(ErrorCode.AI_API_ERROR, { reason: 'API 응답이 비어있음' })
      }

      return {
        valid: true,
        model: 'gemini-2.5-pro',
      }
    } catch (error) {
      this.logger.error('Gemini API 키 검증 실패:', error)

      if (error.message?.includes('API key not valid')) {
        throw new CustomHttpException(ErrorCode.AI_KEY_INVALID, {
          reason: 'API 키가 유효하지 않습니다. 올바른 API 키를 입력해주세요.',
        })
      } else if (error.message?.includes('ByteString') || error.message?.includes('character at index')) {
        throw new CustomHttpException(ErrorCode.AI_KEY_INVALID, {
          reason: 'API 키 형식이 올바르지 않습니다. 영문/숫자만 입력해주세요.',
          detail: error.message,
        })
      } else if (error.message?.includes('quota')) {
        throw new CustomHttpException(ErrorCode.AI_QUOTA_EXCEEDED, {
          reason: 'API 할당량이 초과되었습니다. 나중에 다시 시도해주세요.',
        })
      } else if (error.message?.includes('permission')) {
        throw new CustomHttpException(ErrorCode.AI_NO_PERMISSION, { reason: 'API 키에 필요한 권한이 없습니다.' })
      } else if (error.message?.includes('not found')) {
        throw new CustomHttpException(ErrorCode.AI_API_ERROR, {
          reason: 'API 버전 또는 모델이 올바르지 않습니다. Gemini API가 활성화되어 있는지 확인해주세요.',
        })
      }

      throw new CustomHttpException(ErrorCode.AI_API_ERROR, { message: error.message })
    }
  }

  private isGeminiQuotaError(error: any): error is GeminiQuotaError {
    return (
      error?.error?.code === 429 &&
      error?.error?.status === 'RESOURCE_EXHAUSTED' &&
      Array.isArray(error?.error?.details)
    )
  }

  private getRetryDelay(error: any): number {
    if (this.isGeminiQuotaError(error)) {
      const retryInfo = error.error.details.find(detail => detail['@type']?.includes('RetryInfo'))
      if (retryInfo?.retryDelay) {
        // retryDelay format is "51s", convert to seconds
        return parseInt(retryInfo.retryDelay.replace('s', ''))
      }
    }
    return 60 // 기본 60초
  }

  private handleGeminiError(error: any): never {
    this.logger.error('Gemini API 호출 중 오류:', error)

    if (this.isGeminiQuotaError(error)) {
      const retryDelay = this.getRetryDelay(error)
      throw new CustomHttpException(ErrorCode.AI_QUOTA_EXCEEDED, { retryDelay, provider: 'gemini' })
    }

    if (error.message?.includes('not found')) {
      throw new CustomHttpException(ErrorCode.AI_API_ERROR, { reason: 'API not found', provider: 'gemini' })
    }

    throw new CustomHttpException(ErrorCode.AI_API_ERROR, { message: error.message, provider: 'gemini' })
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
      this.handleGeminiError(error)
    }
  }

  async generateBlogOutline(title: string, description: string): Promise<BlogOutline> {
    this.logger.log(`Gemini로 주제 "${title}"에 대한 목차를 생성합니다.`)

    const prompt = `${tableOfContentsPrompt}
[user]
title: ${title}
description: ${description}`

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

      return JSON.parse(resp.text) as BlogOutline
    } catch (error) {
      this.handleGeminiError(error)
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

      return JSON.parse(resp.text) as BlogPost
    } catch (error) {
      this.handleGeminiError(error)
    }
  }

  async generatePixabayPrompt(html: string): Promise<string[]> {
    try {
      const ai = await this.getGemini()
      const prompt = `다음 HTML 콘텐츠를 분석하여 Pixabay 이미지에서 검색할 키워드 5개를 추천해주세요.
콘텐츠의 주제와 내용을 잘 반영하는 키워드를 선택해주세요.
키워드는 영어로 작성해주세요.

[HTML 콘텐츠]
${html}

응답 형식:
{
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`

      const resp = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              keywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                minItems: 5,
                maxItems: 5,
              },
            },
            required: ['keywords'],
          },
        },
      })

      const result = JSON.parse(resp.text)
      return result.keywords
    } catch (error) {
      this.handleGeminiError(error)
    }
  }

  async generateAiImagePrompt(html: string): Promise<string> {
    try {
      const ai = await this.getGemini()
      const prompt = `다음 HTML 콘텐츠를 분석하여 이미지 생성 AI에 입력할 프롬프트를 작성해주세요.
콘텐츠의 주제와 내용을 잘 반영하는 이미지를 생성할 수 있도록 프롬프트를 작성해주세요.
프롬프트는 영어로 작성해주세요.

[HTML 콘텐츠]
${html}

응답 형식:
{
  "prompt": "프롬프트"
}`

      const resp = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              prompt: { type: Type.STRING },
            },
            required: ['prompt'],
          },
        },
      })

      const result = JSON.parse(resp.text)
      return result.prompt
    } catch (error) {
      this.handleGeminiError(error)
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
      this.handleGeminiError(error)
    }
  }

  async generateThumbnailData(content: string): Promise<ThumbnailData> {
    this.logger.log('Gemini로 썸네일 텍스트 데이터를 생성합니다.')

    try {
      const ai = await this.getGemini()
      const prompt = `다음 콘텐츠를 분석하여 썸네일 이미지에 들어갈 텍스트를 추천해주세요.
콘텐츠의 주제와 내용을 잘 반영하고, 클릭을 유도할 수 있는 텍스트를 작성해주세요.

[콘텐츠]
${content}

응답 형식:
{
  "mainTitle": "메인 타이틀 (15자 이내)",
  "subTitle": "서브 타이틀 (20자 이내)",
  "description": "설명 (30자 이내)"
}`

      const resp = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mainTitle: { type: Type.STRING },
              subTitle: { type: Type.STRING },
              description: { type: Type.STRING },
            },
            required: ['mainTitle', 'subTitle', 'description'],
          },
        },
      })

      return JSON.parse(resp.text) as ThumbnailData
    } catch (error) {
      this.handleGeminiError(error)
    }
  }

  /**
   * 본문에서 링크 검색용 검색어를 추출
   */
  async generateLinkSearchPrompt(html: string): Promise<string> {
    try {
      const ai = await this.getGemini()
      const prompt = `다음 HTML 콘텐츠를 분석하여 구글 등에서 검색할 때 가장 적합한 한글 검색어 1개를 추천해주세요.\n\n[HTML 콘텐츠]\n${html}\n\n응답 형식:\n{\n  \"keyword\": \"검색어\"\n}`
      const resp = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              keyword: { type: Type.STRING },
            },
            required: ['keyword'],
          },
        },
      })
      const result = JSON.parse(resp.text)
      return result.keyword
    } catch (error) {
      this.handleGeminiError(error)
    }
  }

  /**
   * 본문에서 유튜브 검색용 검색어를 추출
   */
  async generateYoutubeSearchPrompt(html: string): Promise<string> {
    try {
      const ai = await this.getGemini()
      const prompt = `다음 HTML 콘텐츠를 분석하여 유튜브에서 검색할 때 가장 적합한 한글 검색어 1개를 추천해주세요.\n\n[HTML 콘텐츠]\n${html}\n\n응답 형식:\n{\n  \"keyword\": \"검색어\"\n}`
      const resp = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              keyword: { type: Type.STRING },
            },
            required: ['keyword'],
          },
        },
      })
      const result = JSON.parse(resp.text)
      return result.keyword
    } catch (error) {
      this.handleGeminiError(error)
    }
  }
}
