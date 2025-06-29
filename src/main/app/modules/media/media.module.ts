import { Module } from '@nestjs/common'
import { ImageAgent } from './image.agent'
import { ImageUploadService } from './image-upload.service'
import { SettingsModule } from '../settings/settings.module'

@Module({
  imports: [SettingsModule],
  providers: [ImageAgent, ImageUploadService],
  exports: [ImageAgent, ImageUploadService],
})
export class MediaModule {}
