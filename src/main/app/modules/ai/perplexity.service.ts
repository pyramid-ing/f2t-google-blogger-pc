import { Injectable, Logger } from '@nestjs/common'
import { createPerplexity } from '@ai-sdk/perplexity'
import { generateText } from 'ai'
import axios from 'axios'
import { SettingsService } from '../settings/settings.service'

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

@Injectable()
export class PerplexityService {
  private readonly logger = new Logger(PerplexityService.name)
  private perplexityProvider: any

  constructor(private readonly settingsService: SettingsService) {}

  private async getApiKey(): Promise<string> {
    const settings = await this.settingsService.getAppSettings()
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

우선순위:
1. 정부 기관, 공공기관 등 공신력 있는 기관 (.go.kr, .gov, .edu 등)
2. 위키백과 (wikipedia.org)
3. 나무위키 (namu.wiki)
4. 기타 신뢰할 수 있는 출처(뉴스, 신문 등)
5. tistory, naver blog는 제외. 

HTML 내용:
${htmlContent}

응답은 반드시 JSON 배열 형식으로만 제공해주세요. 각 링크는 name(제목)과 link(URL)를 포함해야 합니다. 예시:
[
  {"name": "한국 정부 공식 사이트", "link": "https://example.gov.kr/link1"}
]

최대 1개의 링크만 제공하고, 링크는 실제 존재하는 유효한 URL이어야 합니다.
`

      const provider = await this.getPerplexityProvider()
      const model = provider('sonar-pro')

      const systemPrompt =
        '당신은 신뢰할 수 있는 정보원을 찾는 전문가입니다. 한국어 콘텐츠에 대해서는 한국의 공신력 있는 기관과 사이트를 우선적으로 찾아주세요.'
      const fullPrompt = `${systemPrompt}\n\n${prompt}`

      const { text: content, sources } = await generateText({
        model,
        prompt: fullPrompt,
        maxTokens: 500,
        temperature: 0.2,
      })

      this.logger.log(`Perplexity 응답: ${content}`)
      this.logger.log(`Sources: ${JSON.stringify(sources)}`)

      // JSON 파싱 시도
      try {
        const links = JSON.parse(content)
        if (Array.isArray(links)) {
          // 각 항목이 올바른 형태인지 확인하고 변환
          const validLinks: LinkResult[] = links
            .filter(item => item && typeof item.name === 'string' && typeof item.link === 'string')
            .map(item => ({
              name: item.name,
              link: item.link,
            }))
            .slice(0, 1) // 최대 1개까지만

          this.logger.log(`생성된 링크 수: ${validLinks.length}`)
          return validLinks
        }
      } catch (parseError) {
        this.logger.warn('JSON 파싱 실패, 정규식으로 URL 추출 시도')

        // JSON 파싱 실패 시 정규식으로 URL 추출하고 의미 있는 name 설정
        const urlRegex = /https?:\/\/[^\s\]"']+/g
        const extractedUrls = content.match(urlRegex) || []
        const urls = extractedUrls.slice(0, 1)

        // 각 URL에 대해 title을 가져오기 (Promise.all 사용)
        const linkResults = await Promise.all(
          urls.map(async url => ({
            name: await this.generateLinkNameFromUrl(url),
            link: url,
          })),
        )

        return linkResults
      }

      return []
    } catch (error) {
      this.logger.error('Perplexity API 호출 중 오류 발생:', error)

      // 오류 발생 시 빈 배열 반환 (워크플로우 중단 방지)
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
