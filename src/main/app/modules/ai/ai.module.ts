import { Module } from '@nestjs/common'
import { OpenAiService } from '@main/app/modules/ai/openai.service'
import { PerplexityService } from '@main/app/modules/ai/perplexity.service'
import { GeminiService } from './gemini.service'
import { CommonModule } from '../common/common.module'
import { AIFactory } from './ai.factory'
import { SettingsModule } from '../settings/settings.module'
import { AIController } from './ai.controller'
import { StorageModule } from '../google/storage/storage.module'

@Module({
  imports: [CommonModule, SettingsModule, StorageModule],
  providers: [OpenAiService, PerplexityService, GeminiService, AIFactory],
  exports: [OpenAiService, PerplexityService, GeminiService, AIFactory],
  controllers: [AIController],
})
export class AIModule {}
