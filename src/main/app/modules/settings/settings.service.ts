import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { AppSettings } from './settings.types'

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name)

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<AppSettings> {
    const settings = await this.prisma.settings.findFirst({
      where: { id: 1 },
    })

    return (
      (settings?.data as unknown as AppSettings) || {
        aiProvider: 'gemini',
      }
    )
  }

  async updateSettings(newSettings: Partial<AppSettings>) {
    // 현재 설정을 가져옵니다
    const currentSettings = await this.getSettings()

    // 새로운 설정과 현재 설정을 병합합니다
    const mergedSettings = {
      ...currentSettings,
      ...newSettings,
    }

    // 병합된 설정을 저장합니다
    await this.prisma.settings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        data: mergedSettings,
      },
      update: {
        data: mergedSettings,
      },
    })

    // 업데이트된 설정을 반환합니다
    return mergedSettings
  }
}
