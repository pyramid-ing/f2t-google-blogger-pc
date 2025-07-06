import { Injectable, Logger } from '@nestjs/common'
import { OpenAiService } from 'src/main/app/modules/ai/openai.service'
import { Topic } from '@main/app/modules/ai/ai.interface'

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
      const titles = await this.openAiService.generateTopics(topic, limit)
      this.logger.log(`${titles.length}개의 제목이 생성되었습니다.`)
      return titles
    } catch (error) {
      this.logger.error('제목 생성 중 오류 발생:', error)
      throw error
    }
  }
}
