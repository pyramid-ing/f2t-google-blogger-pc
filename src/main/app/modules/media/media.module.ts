import { Module } from '@nestjs/common'
import { ImagePixabayService } from 'src/main/app/modules/media/image-pixabay.service'
import { ThumbnailGeneratorService } from './thumbnail-generator.service'
import { ThumbnailController } from './thumbnail.controller'
import { SettingsModule } from '../settings/settings.module'
import { AIModule } from '../ai/ai.module'
import { CommonModule } from '@main/app/modules/common/common.module'
import { GoogleModule } from '../google/google.module'

@Module({
  imports: [SettingsModule, AIModule, CommonModule, GoogleModule],
  controllers: [ThumbnailController],
  providers: [ImagePixabayService, ThumbnailGeneratorService],
  exports: [ImagePixabayService, ThumbnailGeneratorService],
})
export class MediaModule {}
