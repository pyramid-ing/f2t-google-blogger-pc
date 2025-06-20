import { Controller, Post, Body } from '@nestjs/common'
import { CrawlService } from './crawl.service'
import { CreateCrawlJobDto } from './dto/crawl-job.dto'

@Controller('crawl')
export class CrawlController {
  constructor(private readonly crawlService: CrawlService) {}

  @Post('add-job')
  async addCrawlJob(@Body() createCrawlJobDto: CreateCrawlJobDto) {
    const job = await this.crawlService.addCrawlJob(createCrawlJobDto.url)
    return {
      message: '크롤링 작업이 성공적으로 추가되었습니다.',
      jobId: job.id,
      url: createCrawlJobDto.url,
    }
  }
}
