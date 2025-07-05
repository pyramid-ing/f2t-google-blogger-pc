import { Module } from '@nestjs/common'
import { GoogleOauthModule } from 'src/main/app/modules/google/oauth/google-oauth.module'
import { GoogleBloggerModule } from '@main/app/modules/google/blogger/google-blogger.module'
import { StorageModule } from './storage/storage.module'

@Module({
  imports: [GoogleOauthModule, GoogleBloggerModule, StorageModule],
  exports: [GoogleOauthModule, GoogleBloggerModule, StorageModule],
})
export class GoogleModule {}
