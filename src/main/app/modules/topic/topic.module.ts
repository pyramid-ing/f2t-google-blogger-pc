import { Module } from '@nestjs/common'
import { TopicService } from './topic.service'
import { SettingsModule } from '../settings/settings.module'
import { TopicJobService } from './topic-job.service'
import { AIModule } from '@main/app/modules/ai/ai.module'
import { TopicJobController } from './topic-job.controller'

@Module({
  imports: [SettingsModule, AIModule],
  providers: [TopicService, TopicJobService],
  exports: [TopicService, TopicJobService],
  controllers: [TopicJobController],
})
export class TopicModule {}
