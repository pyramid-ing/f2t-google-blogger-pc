import { Module } from '@nestjs/common'
import { GoogleOauthModule } from 'src/main/app/modules/google/oauth/google-oauth.module'
import { GoogleBloggerModule } from '@main/app/modules/google/blogger/google-blogger.module'

@Module({
  imports: [GoogleOauthModule, GoogleBloggerModule],
  exports: [GoogleOauthModule, GoogleBloggerModule],
})
export class GoogleModule {}
