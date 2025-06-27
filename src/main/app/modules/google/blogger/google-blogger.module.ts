import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { GoogleBloggerController } from 'src/main/app/modules/google/blogger/google-blogger.controller'
import { GoogleBloggerService } from 'src/main/app/modules/google/blogger/google-blogger.service'
import { PrismaService } from 'src/main/app/shared/prisma.service'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { OauthService } from '@main/app/modules/google/oauth/oauth.service'

@Module({
  imports: [HttpModule],
  providers: [GoogleBloggerService, PrismaService, SettingsService, OauthService],
  controllers: [GoogleBloggerController],
  exports: [GoogleBloggerService],
})
export class GoogleBloggerModule {}
