import { Module } from '@nestjs/common'
import { GeminiService } from './gemini.service'
import { CommonModule } from '../common/common.module'
import { AIFactory } from './ai.factory'
import { SettingsModule } from '../settings/settings.module'
import { AIController } from './ai.controller'
import { StorageModule } from '../google/storage/storage.module'

@Module({
  imports: [CommonModule, SettingsModule, StorageModule],
  providers: [GeminiService, AIFactory],
  exports: [GeminiService, AIFactory],
  controllers: [AIController],
})
export class AIModule {}
