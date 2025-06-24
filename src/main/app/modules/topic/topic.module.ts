import { Module } from '@nestjs/common'
import { TopicService } from './topic.service'
import { OpenAiService } from './openai.service'

@Module({
  providers: [TopicService, OpenAiService],
  exports: [TopicService],
})
export class TopicModule {}
