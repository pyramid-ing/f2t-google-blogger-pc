import { Module } from '@nestjs/common'
import { SettingsController } from './settings.controller'
import { SettingsService } from './settings.service'
import { AIModule } from '../ai/ai.module'
import { CommonModule } from '@main/app/modules/common/common.module'

@Module({
  imports: [CommonModule, AIModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
