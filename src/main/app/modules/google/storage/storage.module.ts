import { Module } from '@nestjs/common'
import { StorageService } from './storage.service'
import { SettingsModule } from '../../settings/settings.module'

@Module({
  imports: [SettingsModule],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
