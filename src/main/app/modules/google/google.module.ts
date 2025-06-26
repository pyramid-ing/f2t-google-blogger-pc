import { Module } from '@nestjs/common'
import { GoogleOauthModule } from 'src/main/app/modules/google/oauth/google-oauth.module'

@Module({
  imports: [GoogleOauthModule],
  exports: [GoogleOauthModule],
})
export class GoogleModule {}
