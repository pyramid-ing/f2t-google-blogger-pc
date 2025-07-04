import { Module } from '@nestjs/common'
import { JobQueueProcessor } from './job-queue.processor'
import { BlogPostJobModule } from '../blog-post-job/blog-post-job.module'
import { CommonModule } from '@main/app/modules/common/common.module'

@Module({
  imports: [BlogPostJobModule, CommonModule],
  providers: [JobQueueProcessor],
  exports: [JobQueueProcessor],
})
export class JobModule {}
