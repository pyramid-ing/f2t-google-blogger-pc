import { Module } from '@nestjs/common'
import { BloggerService } from './blogger.service'
import { SeoService } from './seo.service'

@Module({
  providers: [BloggerService, SeoService],
  exports: [BloggerService, SeoService],
})
export class BlogModule {}
