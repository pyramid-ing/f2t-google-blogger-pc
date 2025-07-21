import { Module } from '@nestjs/common'
import { TistoryService } from 'src/main/app/modules/tistory/tistory.service'
import { SettingsModule } from '../settings/settings.module'

@Module({
  imports: [SettingsModule],
  providers: [TistoryService],
  controllers: [],
  exports: [TistoryService],
})
export class TistoryModule {}
