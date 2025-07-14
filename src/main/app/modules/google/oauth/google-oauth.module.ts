import { Module } from '@nestjs/common'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { GoogleOAuthController } from '@main/app/modules/google/oauth/google-oauth.controller'
import { GoogleOauthService } from '@main/app/modules/google/oauth/google-oauth.service'
import { CommonModule } from '@main/app/modules/common/common.module'

@Module({
  imports: [CommonModule],
  providers: [SettingsService, GoogleOauthService],
  controllers: [GoogleOAuthController],
})
export class GoogleOauthModule {}
