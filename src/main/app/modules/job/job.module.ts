import { Module } from '@nestjs/common'
import { JobQueueProcessor } from './job-queue.processor'
import { JobController } from './job.controller'
import { PrismaModule } from '../common/prisma/prisma.module'
import { BlogPostJobModule } from '@main/app/modules/blog-post-job/blog-post-job.module'
import { ScheduleModule } from '@nestjs/schedule'

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, BlogPostJobModule],
  providers: [JobQueueProcessor],
  controllers: [JobController],
  exports: [JobQueueProcessor],
})
export class JobModule {}
