import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { GoogleBloggerController } from 'src/main/app/modules/google/blogger/google-blogger.controller'
import { GoogleBloggerService } from 'src/main/app/modules/google/blogger/google-blogger.service'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { GoogleOauthService } from '@main/app/modules/google/oauth/google-oauth.service'
import { CommonModule } from '@main/app/modules/common/common.module'

@Module({
  imports: [HttpModule, CommonModule],
  providers: [GoogleBloggerService, SettingsService, GoogleOauthService],
  controllers: [GoogleBloggerController],
  exports: [GoogleBloggerService],
})
export class GoogleBloggerModule {}
