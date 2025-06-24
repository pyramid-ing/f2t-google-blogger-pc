import { Module } from '@nestjs/common'
import { ImageAgent } from './image.agent'
import { ImageUploadService } from './image-upload.service'

@Module({
  providers: [ImageAgent, ImageUploadService],
  exports: [ImageAgent, ImageUploadService],
})
export class MediaModule {}
