import { Module } from '@nestjs/common'
import { BlogPostJobService } from './blog-post-job.service'
import { AIModule } from '../ai/ai.module'
import { UtilModule } from '../util/util.module'
import { CommonModule } from '@main/app/modules/common/common.module'
import { PublishModule } from '../publish/publish.module'
import { ContentGenerateModule } from '@main/app/modules/content-generate/content-generate.module'

@Module({
  imports: [CommonModule, AIModule, UtilModule, PublishModule, ContentGenerateModule],
  providers: [BlogPostJobService],
  exports: [BlogPostJobService],
})
export class BlogPostJobModule {}
