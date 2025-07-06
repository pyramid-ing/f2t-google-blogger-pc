import { Body, Controller, Post } from '@nestjs/common'
import { ValidateAIKeyDto } from '../settings/dto/validate-ai-key.dto'
import { OpenAiService } from './openai.service'
import { GeminiService } from './gemini.service'

@Controller('ai')
export class AIController {
  constructor(
    private readonly openAiService: OpenAiService,
    private readonly geminiService: GeminiService,
  ) {}

  @Post('validate-key')
  async validateAIKey(@Body() dto: ValidateAIKeyDto & { provider: 'openai' | 'gemini' }) {
    if (dto.provider === 'openai') {
      return this.openAiService.validateApiKey(dto.apiKey)
    } else {
      return this.geminiService.validateApiKey(dto.apiKey)
    }
  }
}
