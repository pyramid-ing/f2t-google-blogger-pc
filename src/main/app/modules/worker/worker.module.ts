import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { PostWorkerProcessor } from './post-worker.processor'
import { AIModule } from '../ai/ai.module'
import { MediaModule } from '../media/media.module'
import { BlogModule } from '../blog/blog.module'

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'posts',
    }),
    AIModule,
    MediaModule,
    BlogModule,
  ],
  providers: [PostWorkerProcessor],
})
export class WorkerModule {}
