import { Module } from '@nestjs/common'
import { TopicService } from './topic.service'
import { OpenAiService } from './openai.service'
import { SettingsModule } from '../settings/settings.module'

@Module({
  imports: [SettingsModule],
  providers: [TopicService, OpenAiService],
  exports: [TopicService],
})
export class TopicModule {}
