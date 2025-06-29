import { Injectable, Logger } from '@nestjs/common'
import { BlogOutline, BlogPostHtml, OpenAiService, Topic } from 'src/main/app/modules/ai/openai.service'

@Injectable()
export class TopicService {
  private readonly logger = new Logger(TopicService.name)

  constructor(private readonly openAiService: OpenAiService) {}

  /**
   * 주제에 대한 SEO 최적화된 제목 생성
   */
  async generateTopics(topic: string, limit: number): Promise<Topic[]> {
    this.logger.log(`주제 "${topic}"에 대한 제목 생성을 시작합니다.`)

    try {
      const titles = await this.openAiService.generateSeoTitles(topic, limit)
      this.logger.log(`${titles.length}개의 제목이 생성되었습니다.`)
      return titles
    } catch (error) {
      this.logger.error('제목 생성 중 오류 발생:', error)
      throw error
    }
  }

  /**
   * OpenAI를 사용하여 주제에 대한 목차 생성
   */
  async generateBlogOutline(title: string, description: string): Promise<BlogOutline> {
    this.logger.log(`OpenAI로 주제 "${title}"에 대한 목차를 생성합니다.`)

    try {
      const response = await this.openAiService.generateBlogOutline(title, description)
      return response
    } catch (error) {
      this.logger.error('OpenAI API 호출 중 오류 발생:', error)
      throw new Error(`OpenAI API 오류: ${error.message}`)
    }
  }

  /**
   * OpenAI를 사용하여 섹션에 대한 구체적인 콘텐츠 생성
   */
  async generatePostingContentsWithOpenAI(blogOutline: BlogOutline): Promise<BlogPostHtml> {
    try {
      const response = await this.openAiService.generatePostingContents(blogOutline)
      return response
    } catch (error) {
      this.logger.error('OpenAI API 호출 중 오류 발생:', error)
      throw new Error(`OpenAI API 오류: ${error.message}`)
    }
  }

  /**
   * Combine HTML sections into a single HTML string
   */
  combineHtmlSections(blogPostHtml: BlogPostHtml): string {
    return blogPostHtml.sections
      .map(section => {
        let html = section.html

        // 관련 링크 추가 (내용 후, 이미지 전)
        if (section.links && section.links.length > 0) {
          section.links.forEach(linkResult => {
            html += `\n<a href="${linkResult.link}" target="_blank" rel="noopener noreferrer" style="display: block; margin: 4px 0; color: #007bff; text-decoration: none; font-size: 14px; padding: 2px 0;">🔗 ${linkResult.name}</a>`
          })
        }

        // 이미지 추가 (링크 후)
        if (section.imageUrl) {
          html += `\n<img src="${section.imageUrl}" alt="section image" style="width: 100%; height: auto; margin: 10px 0;" />`
        }

        return html
      })
      .join('\n')
  }
}
