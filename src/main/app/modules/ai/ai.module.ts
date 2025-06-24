import { Module } from '@nestjs/common'
import { AIService } from './ai.service'
import { YoutubeAgent } from './youtube.agent'

@Module({
  providers: [AIService, YoutubeAgent],
  exports: [AIService, YoutubeAgent],
})
export class AIModule {}
