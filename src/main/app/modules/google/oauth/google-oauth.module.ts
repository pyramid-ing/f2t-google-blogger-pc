import { Module } from '@nestjs/common'
import { PrismaService } from '@main/app/shared/prisma.service'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { GoogleOAuthController } from '@main/app/modules/google/oauth/google-oauth.controller'

@Module({
  providers: [SettingsService, PrismaService],
  controllers: [GoogleOAuthController],
})
export class GoogleOauthModule {}
