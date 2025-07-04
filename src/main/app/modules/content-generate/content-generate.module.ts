import { Module } from '@nestjs/common'
import { ContentGenerateService } from './content-generate.service'
import { AIModule } from '../ai/ai.module'
import { MediaModule } from '../media/media.module'
import { SettingsModule } from '../settings/settings.module'

@Module({
  imports: [AIModule, MediaModule, SettingsModule],
  providers: [ContentGenerateService],
  exports: [ContentGenerateService],
})
export class ContentGenerateModule {}
