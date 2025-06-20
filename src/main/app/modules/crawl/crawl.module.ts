import { BullModule } from '@nestjs/bull'
import { Module } from '@nestjs/common'
import { CrawlController } from './crawl.controller'
import { CrawlService } from './crawl.service'
import { CrawlWorkerService } from './crawl-worker.service'

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'crawl',
    }),
  ],
  controllers: [CrawlController],
  providers: [CrawlService, CrawlWorkerService],
})
export class CrawlModule {}
