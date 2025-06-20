import { Injectable } from '@nestjs/common'
import { Process, Processor } from '@nestjs/bull'
import { Job } from 'bull'
import puppeteer from 'puppeteer-core'
import axios from 'axios'
import { CrawlJobResult } from './dto/crawl-job.dto'

interface CrawlJobData {
  url: string
}

@Injectable()
@Processor('crawl')
export class CrawlWorkerService {
  @Process('crawl-job')
  async handleCrawlJob(job: Job<CrawlJobData>) {
    const { url } = job.data

    let result = ''
    try {
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS용 Chrome 경로
      })
      const page = await browser.newPage()

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      result = await page.title() // 예시로 제목만 추출

      await browser.close()

      // 결과 전송
      await axios.post('https://n8n.pyramid-ing.com/webhook/redis/test', {
        url,
        title: result,
        status: 'success',
      })

      return { success: true, title: result, url } as CrawlJobResult
    } catch (err) {
      console.error('[크롤링 에러]', err.message)

      await axios.post('https://n8n.pyramid-ing.com/webhook/redis/test', {
        url,
        error: err.message,
        status: 'fail',
      })

      throw err
    }
  }
}
