import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { AppSettings } from './settings.types'

const OAUTH2_CLIENT_ID = '365896770281-rrr9tqujl2qvgsl2srdl8ccjse9dp86t.apps.googleusercontent.com'
const OAUTH2_CLIENT_SECRET = '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'

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name)

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<AppSettings> {
    const settings = await this.prisma.settings.findFirst({
      where: { id: 1 },
    })

    const defaultSettings: AppSettings = {
      aiProvider: 'gemini',
      oauth2ClientId: OAUTH2_CLIENT_ID,
      oauth2ClientSecret: OAUTH2_CLIENT_SECRET,
    }
    const merged = {
      ...defaultSettings,
      ...(settings?.data as unknown as AppSettings),
      aiProvider: defaultSettings.aiProvider,
      oauth2ClientId: OAUTH2_CLIENT_ID,
      oauth2ClientSecret: OAUTH2_CLIENT_SECRET,
    }
    return merged
  }

  async updateSettings(newSettings: Partial<AppSettings>) {
    const currentSettings = await this.getSettings()
    const mergedSettings = {
      ...currentSettings,
      ...newSettings,
      aiProvider: 'gemini',
      oauth2ClientId: OAUTH2_CLIENT_ID,
      oauth2ClientSecret: OAUTH2_CLIENT_SECRET,
    }
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
    return mergedSettings
  }
}
