import { Body, Controller, Post } from '@nestjs/common'
import { ValidateAIKeyDto } from '../settings/dto/validate-ai-key.dto'
import { OpenAiService } from './openai.service'
import { GeminiService } from './gemini.service'
import { PerplexityService } from './perplexity.service'

@Controller('ai')
export class AIController {
  constructor(
    private readonly openAiService: OpenAiService,
    private readonly geminiService: GeminiService,
    private readonly perplexityService: PerplexityService,
  ) {}

  @Post('validate-key')
  async validateAIKey(@Body() dto: ValidateAIKeyDto & { provider: 'openai' | 'gemini' | 'perplexity' }) {
    switch (dto.provider) {
      case 'openai':
        return this.openAiService.validateApiKey(dto.apiKey)
      case 'gemini':
        return this.geminiService.validateApiKey(dto.apiKey)
      case 'perplexity':
        return this.perplexityService.validateApiKey(dto.apiKey)
      default:
        throw new Error('지원하지 않는 AI 제공자입니다.')
    }
  }
}
