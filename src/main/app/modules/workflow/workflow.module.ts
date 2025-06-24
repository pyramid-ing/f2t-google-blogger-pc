import { Module } from '@nestjs/common'
import { WorkflowController } from './workflow.controller'
import { TopicModule } from '../topic/topic.module'

@Module({
  imports: [TopicModule],
  controllers: [WorkflowController],
  providers: [],
  exports: [],
})
export class WorkflowModule {}
