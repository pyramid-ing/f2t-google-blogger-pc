import { Module } from '@nestjs/common'
import { OpenAiService } from '@main/app/modules/ai/openai.service'
import { PerplexityService } from '@main/app/modules/ai/perplexity.service'
import { SettingsModule } from '../settings/settings.module'

@Module({
  imports: [SettingsModule],
  providers: [OpenAiService, PerplexityService],
  exports: [OpenAiService, PerplexityService],
})
export class AIModule {}
