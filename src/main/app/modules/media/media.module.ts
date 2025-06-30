import { Module } from '@nestjs/common'
import { ImagePixabayService } from 'src/main/app/modules/media/image-pixabay.service'
import { ThumbnailGeneratorService } from './thumbnail-generator.service'
import { GCSUploadService } from './gcs-upload.service'
import { ThumbnailController } from './thumbnail.controller'
import { SettingsModule } from '../settings/settings.module'

@Module({
  imports: [SettingsModule],
  controllers: [ThumbnailController],
  providers: [ImagePixabayService, ThumbnailGeneratorService, GCSUploadService],
  exports: [ImagePixabayService, ThumbnailGeneratorService, GCSUploadService],
})
export class MediaModule {}
