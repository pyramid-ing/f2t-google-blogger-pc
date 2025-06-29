import { Module } from '@nestjs/common'
import { OpenAiService } from '@main/app/modules/ai/openai.service'

@Module({
  providers: [OpenAiService],
  exports: [OpenAiService],
})
export class AIModule {}
