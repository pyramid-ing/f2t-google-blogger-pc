import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { AppSettings } from './settings.types'

@Injectable()
export class SettingsService {
  private settings: AppSettings | null = null
  private readonly logger = new Logger(SettingsService.name)

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<AppSettings> {
    const settings = await this.prisma.settings.findFirst({
      where: { id: 1 },
    })

    return settings.data as unknown as AppSettings
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

    return this.settings!
  }
}
