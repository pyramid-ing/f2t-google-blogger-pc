import { Body, Controller, Post } from '@nestjs/common'
import { TistoryService, TistoryPostOptions } from 'src/main/app/modules/tistory/tistory.service'

@Controller('tistory')
export class TistoryController {
  constructor(private readonly tistoryBotService: TistoryService) {}

  @Post()
  async postBlog(@Body() body: TistoryPostOptions & { headless?: boolean }) {
    return await this.tistoryBotService.publish(body, body.headless ?? true)
  }
}
