import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'

@Injectable()
export class CrawlService {
  constructor(
    @InjectQueue('crawl')
    private readonly crawlQueue: Queue,
  ) {}

  async addCrawlJob(url: string) {
    const job = await this.crawlQueue.add('crawl-job', { url })
    return job
  }
}
