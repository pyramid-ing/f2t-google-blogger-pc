import { Injectable, Logger } from '@nestjs/common'
import { generateObject, generateText } from 'ai'
import axios from 'axios'
import { z } from 'zod'
import { SettingsService } from '../settings/settings.service'
import { createPerplexity } from '@ai-sdk/perplexity'

// iconv-lite import (optional, graceful fallback if not installed)
let iconv: any = null
try {
  iconv = require('iconv-lite')
} catch (error) {
  // iconv-lite가 설치되지 않은 경우 null로 유지
}

export interface LinkResult {
  name: string
  link: string
}

export interface YoutubeResult {
  title: string
  videoId: string
  url: string
}

// Zod 스키마 정의
const LinkResultSchema = z.object({
  name: z.string().min(1).describe('링크의 제목 또는 설명'),
  link: z.string().min(1).describe('실제 URL 링크'),
})

const LinkResultArraySchema = z.object({
  links: z.array(LinkResultSchema).max(1).describe('관련 링크 배열 (최대 1개)'),
})

const YoutubeResultSchema = z.object({
  title: z.string().min(1).describe('유튜브 동영상 제목'),
  videoId: z.string().min(1).describe('유튜브 비디오 ID'),
  url: z.string().min(1).describe('유튜브 동영상 URL'),
})

const YoutubeResultArraySchema = z.object({
  videos: z.array(YoutubeResultSchema).max(1).describe('유튜브 동영상 배열 (최대 1개)'),
})

@Injectable()
export class PerplexityService {
  private readonly logger = new Logger(PerplexityService.name)
  private perplexityProvider: any = null

  constructor(private readonly settingsService: SettingsService) {}

  private async getApiKey(): Promise<string> {
    const settings = await this.settingsService.getSettings()
    const apiKey = settings.perplexityApiKey

    if (!apiKey) {
      throw new Error('Perplexity API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.')
    }

    return apiKey
  }

  private async getPerplexityProvider() {
    if (!this.perplexityProvider) {
      const apiKey = await this.getApiKey()
      this.perplexityProvider = createPerplexity({
        apiKey,
      })
    }
    return this.perplexityProvider
  }

  async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string; model?: string }> {
    try {
      const provider = createPerplexity({
        apiKey,
      })
      const model = provider('sonar-pro')

      const { text } = await generateText({
        model,
        prompt: 'hello',
        maxTokens: 1,
        temperature: 0.1,
      })

      return {
        valid: true,
        model: 'sonar-pro',
      }
    } catch (error) {
      this.logger.error('Perplexity API 키 검증 실패:', error)

      let errorMessage = '알 수 없는 오류가 발생했습니다.'

      if (error.message?.includes('Invalid API key') || error.message?.includes('Authentication failed')) {
        errorMessage = 'API 키가 유효하지 않습니다. 올바른 API 키를 입력해주세요.'
      } else if (error.message?.includes('rate limit') || error.message?.includes('Too Many Requests')) {
        errorMessage = 'API 할당량이 초과되었습니다. 나중에 다시 시도해주세요.'
      } else if (error.message?.includes('insufficient_quota') || error.message?.includes('Account limit exceeded')) {
        errorMessage = '계정의 할당량이 부족합니다. 결제 상태를 확인해주세요.'
      }

      return {
        valid: false,
        error: errorMessage,
      }
    }
  }

  /**
   * HTML 섹션을 분석하여 관련 링크를 생성합니다
   * @param htmlContent HTML 섹션 내용
   * @returns 관련 링크 배열
   */
  async generateRelevantLinks(htmlContent: string): Promise<LinkResult[]> {
    this.logger.log(`Perplexity로 관련 링크 생성 시작`)

    try {
      const prompt = `
다음 HTML 섹션의 내용을 분석하고, 관련된 신뢰할 수 있는 링크를 찾아주세요.

HTML 내용:
${htmlContent}

요구사항:
- 본문 내용과 관련된 신뢰할 수 있는 링크 1개를 찾아주세요
- 링크의 제목(name)은 본문에 들어가는 링크로 어울리는 이름으로 작성해주세요
- 최후에 적당한 게 없으면 해당 사이트의 meta title을 사용해주세요
- 실제 존재하는 유효한 URL이어야 합니다
- 한국어 콘텐츠에 대해서는 한국의 공신력 있는 기관과 사이트를 우선해주세요
`

      const provider = await this.getPerplexityProvider()
      const model = provider('sonar-pro')

      const { object } = await generateObject({
        model,
        schema: LinkResultArraySchema,
        prompt,
        maxTokens: 500,
        temperature: 0.2,
        mode: 'json',
      })

      this.logger.log(`생성된 링크 수: ${object.links.length}`)
      return object.links as LinkResult[]
    } catch (error) {
      this.logger.error('Perplexity API 호출 중 오류 발생:', error)
      return []
    }
  }

  /**
   * HTML 섹션을 분석하여 관련 유튜브 링크를 생성합니다
   * @param htmlContent HTML 섹션 내용
   * @returns 관련 유튜브 링크 배열
   */
  async generateYoutubeLinks(htmlContent: string): Promise<YoutubeResult[]> {
    this.logger.log(`Perplexity로 유튜브 링크 생성 시작`)

    try {
      const prompt = `
다음 HTML 섹션의 내용을 분석하고, 관련된 유튜브 동영상을 찾아주세요.

HTML 내용:
${htmlContent}

요구사항:
- 본문 내용과 관련된 교육적이고 설명이 잘 되어 있는 유튜브 동영상 1개를 찾아주세요
- 제목(title)은 본문 내용과 관련된 설명적인 제목으로 작성해주세요
- videoId는 유튜브 URL에서 추출한 정확한 비디오 ID여야 합니다
- url은 완전한 유튜브 동영상 URL이어야 합니다
- 한국어 콘텐츠를 우선적으로 찾아주세요
- 실제 존재하는 유튜브 동영상이어야 합니다
`

      const provider = await this.getPerplexityProvider()
      const model = provider('sonar-pro')

      const { object } = await generateObject({
        model,
        schema: YoutubeResultArraySchema,
        prompt,
        maxTokens: 500,
        temperature: 0.2,
        mode: 'json',
      })

      this.logger.log(`생성된 유튜브 링크 수: ${object.videos.length}`)
      return object.videos as YoutubeResult[]
    } catch (error) {
      this.logger.error('Perplexity 유튜브 API 호출 중 오류 발생:', error)
      return []
    }
  }

  /**
   * URL에서 의미 있는 링크 이름을 생성합니다
   * @param url 링크 URL
   * @returns 의미 있는 링크 이름
   */
  private async generateLinkNameFromUrl(url: string): Promise<string> {
    try {
      // 실제 웹페이지에 접속해서 title 태그를 가져오기
      const response = await axios.get(url, {
        timeout: 5000, // 5초 타임아웃
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
          'Accept-Charset': 'utf-8, euc-kr, iso-8859-1;q=0.7, *;q=0.3',
        },
        responseType: 'arraybuffer', // 원본 바이트 데이터로 받기
      })

      // 응답을 문자열로 변환하면서 인코딩 처리
      let html: string
      let detectedCharset = 'utf-8' // 기본값

      // 1. HTTP 헤더에서 charset 감지
      const contentType = response.headers['content-type'] || ''
      const headerCharsetMatch = contentType.match(/charset=([^;]+)/i)
      if (headerCharsetMatch) {
        detectedCharset = headerCharsetMatch[1].toLowerCase().trim()
      }

      // 2. 일단 UTF-8로 디코딩 시도
      html = Buffer.from(response.data).toString('utf-8')

      // 3. HTML meta 태그에서 charset 확인
      const metaCharsetMatch = html.match(/<meta[^>]*charset\s*=\s*['"]*([^'">\s]+)/i)
      if (metaCharsetMatch) {
        const metaCharset = metaCharsetMatch[1].toLowerCase().trim()
        if (metaCharset !== detectedCharset) {
          detectedCharset = metaCharset
        }
      }

      // 4. EUC-KR이나 다른 인코딩이 감지되면 적절히 처리
      if (
        detectedCharset.includes('euc-kr') ||
        detectedCharset.includes('ks_c_5601') ||
        detectedCharset.includes('ksc5601')
      ) {
        if (iconv && iconv.encodingExists('euc-kr')) {
          // iconv-lite가 설치되어 있으면 EUC-KR로 정확히 디코딩
          this.logger.log(`EUC-KR 인코딩으로 디코딩 시도: ${url}`)
          try {
            html = iconv.decode(Buffer.from(response.data), 'euc-kr')
          } catch (iconvError) {
            this.logger.warn(`EUC-KR 디코딩 실패, UTF-8 유지: ${iconvError.message}`)
            // UTF-8 디코딩 결과를 그대로 사용
          }
        } else {
          this.logger.warn('iconv-lite가 설치되지 않아 EUC-KR 디코딩을 건너뜀')
        }
      }

      // title 태그 추출
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
      if (titleMatch && titleMatch[1]) {
        let title = titleMatch[1].trim()

        // HTML 엔티티 디코딩
        title = title
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, ' ')

        // 제목이 너무 길면 잘라내기
        if (title.length > 50) {
          title = title.substring(0, 50) + '...'
        }

        return title
      }

      // title을 찾지 못한 경우 도메인 기반으로 이름 생성
      const urlObj = new URL(url)
      const domain = urlObj.hostname.replace(/^www\./, '')
      return `${domain}의 정보`
    } catch (error) {
      this.logger.warn(`URL에서 제목 추출 실패: ${url}`, error)

      // 오류 발생 시 URL 기반으로 기본 이름 생성
      try {
        const urlObj = new URL(url)
        const domain = urlObj.hostname.replace(/^www\./, '')
        return `${domain}의 정보`
      } catch (urlError) {
        return '관련 정보'
      }
    }
  }
}
