import { Injectable, Logger } from '@nestjs/common'
import { GoogleBloggerService } from '../google/blogger/google-blogger.service'
import { ContentGenerateService, ProcessedSection } from '../content-generate/content-generate.service'

@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name)

  constructor(
    private readonly bloggerService: GoogleBloggerService,
    private readonly contentGenerateService: ContentGenerateService,
  ) {}

  /**
   * 블로그 포스트를 발행하는 메서드
   */
  async publishPost(title: string, content: string): Promise<any> {
    try {
      this.logger.log(`포스팅 발행 시작: ${title}`)

      // 1. 썸네일 생성
      const thumbnailUrl = await this.contentGenerateService.generateThumbnailImage(title)

      // 2. 섹션 처리
      const sections = [{ html: content }] // 실제로는 여러 섹션으로 나눌 수 있음
      const processedSections = await this.contentGenerateService.processSectionsInParallel(sections)

      // 3. 섹션 순서 유지를 위해 정렬
      processedSections.sort((a, b) => a.sectionIndex - b.sectionIndex)

      // 4. HTML 결합
      const combinedHtml = this.combineHtmlSections(processedSections, thumbnailUrl)

      // 5. 블로그 포스팅
      const result = await this.bloggerService.postToBlogger({
        title,
        content: combinedHtml,
        isDraft: true, // 초기에는 draft로 생성
      })

      this.logger.log(`✅ Blogger에 포스팅 완료!`)
      this.logger.log(`📝 제목: ${result.title}`)
      this.logger.log(`🔗 URL: ${result.url}`)
      this.logger.log(`📅 발행일: ${result.published}`)
      this.logger.log(`🆔 포스트 ID: ${result.id}`)

      return result
    } catch (error) {
      this.logger.error(`포스트 발행 중 오류 발생: ${error.message}`)
      throw error
    }
  }

  /**
   * HTML 섹션들을 결합하는 메서드
   */
  private combineHtmlSections(sections: ProcessedSection[], thumbnailUrl?: string): string {
    // 썸네일 HTML 생성
    const thumbnailHtml = thumbnailUrl
      ? `<div style="text-align: center; margin-bottom: 30px;">
          <img src="${thumbnailUrl}" alt="thumbnail" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" />
        </div>`
      : ''

    // 섹션 HTML 결합
    const sectionsHtml = sections
      .map(section => {
        let html = section.html

        // 이미지가 있는 경우 추가
        if (section.imageUrl) {
          html = `<div style="text-align: center; margin: 20px 0;">
            <img src="${section.imageUrl}" alt="section image" style="max-width: 100%; height: auto; border-radius: 4px;" />
          </div>\n${html}`
        }

        // 관련 링크가 있는 경우 추가
        if (section.links && section.links.length > 0) {
          const linksHtml = section.links
            .map(link => `<li><a href="${link.url}" target="_blank">${link.title}</a></li>`)
            .join('\n')
          html = `${html}\n<div class="related-links">
            <h4>관련 링크</h4>
            <ul>${linksHtml}</ul>
          </div>`
        }

        return html
      })
      .join('\n\n')

    return thumbnailHtml + sectionsHtml
  }
}
