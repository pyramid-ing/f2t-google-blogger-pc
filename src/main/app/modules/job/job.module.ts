import { Module } from '@nestjs/common'
import { JobQueueProcessor } from './job-queue.processor'
import { JobController } from './job.controller'
import { PrismaModule } from '../common/prisma/prisma.module'
import { BlogPostJobModule } from '@main/app/modules/blog-post-job/blog-post-job.module'
import { ScheduleModule } from '@nestjs/schedule'
import { TopicModule } from '@main/app/modules/topic/topic.module'
import { JobLogsModule } from '@main/app/modules/job-logs/job-logs.module'

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, BlogPostJobModule, TopicModule, JobLogsModule],
  providers: [JobQueueProcessor],
  controllers: [JobController],
  exports: [JobQueueProcessor],
})
export class JobModule {}
