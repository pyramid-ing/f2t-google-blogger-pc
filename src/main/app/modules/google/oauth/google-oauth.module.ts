import { Module } from '@nestjs/common'
import { PrismaService } from '@main/app/shared/prisma.service'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { GoogleOAuthController } from '@main/app/modules/google/oauth/google-oauth.controller'
import { OauthService } from '@main/app/modules/google/oauth/oauth.service'

@Module({
  providers: [SettingsService, PrismaService, OauthService],
  controllers: [GoogleOAuthController],
})
export class GoogleOauthModule {}
