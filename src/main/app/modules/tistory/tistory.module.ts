import { Module } from '@nestjs/common'
import { TistoryService } from 'src/main/app/modules/tistory/tistory.service'
import { TistoryController } from 'src/main/app/modules/tistory/tistory.controller'
import { SettingsModule } from '../settings/settings.module'

@Module({
  imports: [SettingsModule],
  providers: [TistoryService],
  controllers: [TistoryController],
  exports: [TistoryService],
})
export class TistoryModule {}
