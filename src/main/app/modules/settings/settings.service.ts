import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { AIProvider, AppSettings } from './settings.types'

@Injectable()
export class SettingsService {
  private settings: AppSettings | null = null
  private readonly logger = new Logger(SettingsService.name)

  constructor(private readonly prisma: PrismaService) {}

  private async loadSettings() {
    const settings = await this.prisma.settings.findFirst({
      where: { id: 1 },
    })

    this.settings = settings.data as unknown as AppSettings
  }

  async getSettings(): Promise<AppSettings> {
    if (!this.settings) {
      await this.loadSettings()
    }
    return this.settings!
  }

  async updateSettings(settings: Partial<AppSettings>) {
    await this.prisma.settings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        data: settings,
      },
      update: {
        data: settings,
      },
    })

    // 캐시된 설정 업데이트
    await this.loadSettings()
    return this.settings!
  }

  getCurrentAIProvider(): AIProvider {
    return (this.settings?.aiProvider || 'openai') as AIProvider
  }
}
