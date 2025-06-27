import { Module } from '@nestjs/common'
import { WorkflowController } from './workflow.controller'
import { TopicModule } from '../topic/topic.module'
import { GoogleModule } from '@main/app/modules/google/google.module'

@Module({
  imports: [TopicModule, GoogleModule],
  controllers: [WorkflowController],
  providers: [],
  exports: [],
})
export class WorkflowModule {}
