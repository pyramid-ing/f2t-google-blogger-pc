import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { GeminiService } from '../ai/gemini.service'
import { OpenAiService } from '../ai/openai.service'
import { Prisma } from '@prisma/client'
import { AIProvider, AppSettings, ValidateAIKeyDto } from './settings.types'

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name)
  private settings: AppSettings = {
    aiProvider: 'openai',
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly openAiService: OpenAiService,
    private readonly geminiService: GeminiService,
  ) {}

  private async loadSettings() {
    const settings = await this.getSettings()
    this.settings = settings
  }

  async getSettings(): Promise<AppSettings> {
    const settings = await this.prisma.settings.findFirst()

    return settings.data as unknown as AppSettings
  }

  async updateSettings(settings: AppSettings) {
    const data = settings as unknown as Prisma.JsonObject

    const updatedSettings = await this.prisma.settings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        data,
      },
      update: {
        data,
      },
    })

    await this.loadSettings()
    return {
      data: updatedSettings.data as unknown as AppSettings,
    }
  }

  async validateAIKey(dto: ValidateAIKeyDto) {
    if (dto.provider === 'openai') {
      return this.openAiService.validateApiKey(dto.apiKey)
    } else {
      return this.geminiService.validateApiKey(dto.apiKey)
    }
  }

  getCurrentAIProvider(): AIProvider {
    return this.settings.aiProvider
  }
}
