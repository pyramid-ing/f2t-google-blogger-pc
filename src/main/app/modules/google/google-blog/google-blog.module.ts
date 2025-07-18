import { Module, OnModuleInit } from '@nestjs/common'
import { GoogleBlogController } from './google-blog.controller'
import { GoogleBlogService } from './google-blog.service'
import { CommonModule } from '../../common/common.module'
import { SettingsModule } from '@main/app/modules/settings/settings.module'

@Module({
  imports: [CommonModule, SettingsModule],
  controllers: [GoogleBlogController],
  providers: [GoogleBlogService],
  exports: [GoogleBlogService],
})
export class GoogleBlogModule implements OnModuleInit {
  constructor(private readonly googleBlogService: GoogleBlogService) {}

  async onModuleInit() {
    // 애플리케이션 시작 시 기본 블로그 보장
    await this.googleBlogService.ensureDefaultBlog()
  }
}
