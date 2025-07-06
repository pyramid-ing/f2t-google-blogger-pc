import { Injectable } from '@nestjs/common'
import { OpenAiService } from './openai.service'
import { GeminiService } from './gemini.service'
import { SettingsService } from '../settings/settings.service'
import { AIService } from './ai.interface'

@Injectable()
export class AIFactory {
  constructor(
    private readonly openAiService: OpenAiService,
    private readonly geminiService: GeminiService,
    private readonly settingsService: SettingsService,
  ) {}

  async getAIService(): Promise<AIService> {
    const settings = await this.settingsService.getSettings()
    const provider = settings.aiProvider

    switch (provider) {
      case 'gemini':
        return this.geminiService
      case 'openai':
      default:
        return this.openAiService
    }
  }
}
