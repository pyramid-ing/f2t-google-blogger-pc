import { Module } from '@nestjs/common'
import { BlogPostJobService } from './blog-post-job.service'
import { GoogleBloggerModule } from '../google/blogger/google-blogger.module'
import { AIModule } from '../ai/ai.module'
import { MediaModule } from '../media/media.module'
import { UtilModule } from '../util/util.module'
import { CommonModule } from '@main/app/modules/common/common.module'
import { PublishModule } from '../publish/publish.module'
import { TopicModule } from '../topic/topic.module'

@Module({
  imports: [CommonModule, GoogleBloggerModule, AIModule, MediaModule, UtilModule, PublishModule, TopicModule],
  providers: [BlogPostJobService],
  exports: [BlogPostJobService],
})
export class BlogPostJobModule {}
