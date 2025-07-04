import { Module } from '@nestjs/common'
import { WorkflowController } from './workflow.controller'
import { CommonModule } from '@main/app/modules/common/common.module'
import { TopicModule } from '@main/app/modules/topic/topic.module'

@Module({
  imports: [CommonModule, TopicModule],
  controllers: [WorkflowController],
})
export class WorkflowModule {}
