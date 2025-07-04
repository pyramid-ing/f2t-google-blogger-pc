import { Module } from '@nestjs/common'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { GoogleOAuthController } from '@main/app/modules/google/oauth/google-oauth.controller'
import { OauthService } from '@main/app/modules/google/oauth/oauth.service'
import { CommonModule } from '@main/app/modules/common/common.module'

@Module({
  imports: [CommonModule],
  providers: [SettingsService, OauthService],
  controllers: [GoogleOAuthController],
})
export class GoogleOauthModule {}
