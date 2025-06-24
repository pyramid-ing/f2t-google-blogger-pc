import { Injectable, Logger } from '@nestjs/common'
import { PostQueueService } from './post-queue.service'
import * as XLSX from 'xlsx'

export interface PostData {
  title: string
  description: string
  keywords: string[]
}

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name)

  constructor(private readonly queueService: PostQueueService) {}

  async parseExcel(buffer: Buffer): Promise<PostData[]> {
    this.logger.log('엑셀 파일 파싱 시작')

    const workbook = XLSX.read(buffer)
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const rawData = XLSX.utils.sheet_to_json(worksheet)

    return rawData.map(row => ({
      title: row['제목'],
      description: row['설명'],
      keywords: (row['키워드'] as string).split(',').map(k => k.trim()),
    }))
  }

  async enqueuePosts(posts: PostData[]): Promise<void> {
    this.logger.log(`${posts.length}개의 포스트를 큐에 등록합니다`)

    for (const post of posts) {
      await this.queueService.addToQueue(post)
    }
  }
}
