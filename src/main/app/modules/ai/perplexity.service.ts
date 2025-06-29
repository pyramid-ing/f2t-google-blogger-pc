import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { SettingsService } from '../settings/settings.service'

// iconv-lite import (optional, graceful fallback if not installed)
let iconv: any = null
try {
  iconv = require('iconv-lite')
} catch (error) {
  // iconv-lite가 설치되지 않은 경우 null로 유지
}

export interface PerplexityLink {
  url: string
  title: string
  description: string
  source: string
}

export interface LinkResult {
  name: string
  link: string
}

@Injectable()
export class PerplexityService {
  private readonly logger = new Logger(PerplexityService.name)
  private readonly baseUrl = 'https://api.perplexity.ai'

  constructor(private readonly settingsService: SettingsService) {}

  private async getApiKey(): Promise<string> {
    const settings = await this.settingsService.getAppSettings()
    const apiKey = settings.perplexityApiKey

    if (!apiKey) {
      throw new Error('Perplexity API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.')
    }

    return apiKey
  }

  /**
   * HTML 섹션을 분석하여 관련 링크를 생성합니다
   * @param htmlContent HTML 섹션 내용
   * @returns 관련 링크 배열
   */
  async generateRelevantLinks(htmlContent: string): Promise<LinkResult[]> {
    this.logger.log(`Perplexity로 관련 링크 생성 시작`)

    try {
      const apiKey = await this.getApiKey()

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

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [
            {
              role: 'system',
              content:
                '당신은 신뢰할 수 있는 정보원을 찾는 전문가입니다. 한국어 콘텐츠에 대해서는 한국의 공신력 있는 기관과 사이트를 우선적으로 찾아주세요.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 500,
          temperature: 0.2,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      )

      const content = response.data.choices[0].message.content
      this.logger.log(`Perplexity 응답: ${content}`)

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
          } catch (decodeError) {
            this.logger.warn(`EUC-KR 디코딩 실패: ${decodeError.message}`)
            // UTF-8 디코딩 결과 그대로 사용
          }
        } else {
          // iconv-lite가 없으면 기본 처리 방식 사용
          this.logger.warn(`EUC-KR 인코딩 감지됨 (${url}), iconv-lite 라이브러리가 필요합니다`)
        }
      } else if (detectedCharset.includes('iso-8859-1') || detectedCharset.includes('latin1')) {
        if (iconv && iconv.encodingExists('iso-8859-1')) {
          this.logger.log(`ISO-8859-1 인코딩으로 디코딩 시도: ${url}`)
          try {
            html = iconv.decode(Buffer.from(response.data), 'iso-8859-1')
          } catch (decodeError) {
            this.logger.warn(`ISO-8859-1 디코딩 실패: ${decodeError.message}`)
          }
        }
      }

      // 5. HTML에서 title 태그 추출
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)

      if (titleMatch && titleMatch[1]) {
        let title = titleMatch[1].trim()

        // 6. 깨진 문자 패턴을 감지해서 대체 처리
        const brokenCharPattern = /[◇◆□■▲▼◀▶◁▷△▽]/g
        const brokenCharRatio = (title.match(brokenCharPattern) || []).length / title.length

        // 깨진 문자가 30% 이상이면 기본 텍스트 사용
        if (brokenCharRatio > 0.3) {
          this.logger.warn(`깨진 문자 비율이 높음 (${brokenCharRatio.toFixed(2)}): ${title}`)
          return '관련 자료'
        }

        // 7. HTML 엔티티 디코딩 (기본적인 것들만)
        title = title
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, ' ')
          .replace(/&#(\d+);/g, (match, num) => {
            try {
              return String.fromCharCode(parseInt(num))
            } catch {
              return match
            }
          })

        // 8. 너무 긴 제목은 잘라내기 (50자 제한)
        if (title.length > 50) {
          title = title.substring(0, 47) + '...'
        }

        // 9. 여전히 깨진 문자가 많으면 기본 텍스트 사용
        const finalBrokenRatio = (title.match(brokenCharPattern) || []).length / title.length
        if (finalBrokenRatio > 0.2) {
          return '관련 자료'
        }

        return title
      }
    } catch (error) {
      this.logger.warn(`URL ${url}에서 title 가져오기 실패: ${error.message}`)
    }

    // title 가져오기에 실패한 경우 기본 텍스트 반환
    return '관련 자료'
  }

  /**
   * 텍스트에서 키워드를 추출하여 검색 쿼리 생성
   * @param text 분석할 텍스트
   * @returns 검색에 적합한 키워드
   */
  private extractKeywords(text: string): string {
    // HTML 태그 제거
    const plainText = text.replace(/<[^>]*>/g, ' ')

    // 특수문자 제거 및 정규화
    const normalized = plainText
      .replace(/[^\w\s가-힣]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // 첫 100자만 사용 (검색 쿼리 길이 제한)
    return normalized.substring(0, 100)
  }
}
