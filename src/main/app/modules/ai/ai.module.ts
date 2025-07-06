import { Module } from '@nestjs/common'
import { OpenAiService } from '@main/app/modules/ai/openai.service'
import { PerplexityService } from '@main/app/modules/ai/perplexity.service'
import { GeminiService } from './gemini.service'
import { CommonModule } from '../common/common.module'
import { AIFactory } from './ai.factory'
import { SettingsModule } from '../settings/settings.module'

@Module({
  imports: [CommonModule, SettingsModule],
  providers: [OpenAiService, PerplexityService, GeminiService, AIFactory],
  exports: [OpenAiService, PerplexityService, GeminiService, AIFactory],
})
export class AIModule {}
