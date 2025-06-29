import { Module } from '@nestjs/common'
import { WorkflowController } from './workflow.controller'
import { TopicModule } from '../topic/topic.module'
import { GoogleModule } from '@main/app/modules/google/google.module'
import { MediaModule } from '../media/media.module'

@Module({
  imports: [TopicModule, GoogleModule, MediaModule],
  controllers: [WorkflowController],
  providers: [],
  exports: [],
})
export class WorkflowModule {}
