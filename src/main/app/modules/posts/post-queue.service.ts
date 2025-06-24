import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'
import { PostData } from './posts.service'

@Injectable()
export class PostQueueService {
  private readonly logger = new Logger(PostQueueService.name)

  constructor(@InjectQueue('posts') private readonly postsQueue: Queue) {}

  async addToQueue(post: PostData): Promise<void> {
    this.logger.log(`포스트 "${post.title}" 큐에 추가`)

    await this.postsQueue.add(
      'generate',
      {
        title: post.title,
        description: post.description,
        keywords: post.keywords,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    )
  }
}
