import { Module } from '@nestjs/common'
import { TopicService } from './topic.service'
import { OpenAiService } from 'src/main/app/modules/ai/openai.service'
import { SettingsModule } from '../settings/settings.module'

@Module({
  imports: [SettingsModule],
  providers: [TopicService, OpenAiService],
  exports: [TopicService],
})
export class TopicModule {}
