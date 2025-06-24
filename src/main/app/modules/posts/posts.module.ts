import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { PostsController } from './posts.controller'
import { PostsService } from './posts.service'
import { PostQueueService } from './post-queue.service'

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'posts',
    }),
  ],
  controllers: [PostsController],
  providers: [PostsService, PostQueueService],
})
export class PostsModule {}
