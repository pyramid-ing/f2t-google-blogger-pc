import { Injectable, Logger } from '@nestjs/common'
import { GoogleBloggerService } from '../google/blogger/google-blogger.service'

@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name)

  constructor(private readonly bloggerService: GoogleBloggerService) {}

  /**
   * 블로그 포스트를 발행하는 메서드
   */
  async publishPost(title: string, contentHtml: string): Promise<any> {
    try {
      this.logger.log(`포스팅 발행 시작: ${title}`)

      // 5. 블로그 포스팅
      const result = await this.bloggerService.postToBlogger({
        title,
        content: contentHtml,
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
}
