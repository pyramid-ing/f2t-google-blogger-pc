import { Module } from '@nestjs/common'
import { WorkflowController } from './workflow.controller'
import { TopicModule } from '../topic/topic.module'
import { GoogleModule } from '@main/app/modules/google/google.module'
import { MediaModule } from '../media/media.module'
import { SettingsModule } from '../settings/settings.module'

@Module({
  imports: [TopicModule, GoogleModule, MediaModule, SettingsModule],
  controllers: [WorkflowController],
  providers: [],
  exports: [],
})
export class WorkflowModule {}
