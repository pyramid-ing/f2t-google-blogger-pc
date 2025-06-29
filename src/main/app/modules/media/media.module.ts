import { Module } from '@nestjs/common'
import { ImagePixabayService } from 'src/main/app/modules/media/image-pixabay.service'
import { SettingsModule } from '../settings/settings.module'

@Module({
  imports: [SettingsModule],
  providers: [ImagePixabayService],
  exports: [ImagePixabayService],
})
export class MediaModule {}
