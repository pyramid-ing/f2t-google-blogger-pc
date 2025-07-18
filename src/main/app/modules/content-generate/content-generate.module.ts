import { Module } from '@nestjs/common'
import { ContentGenerateService } from './content-generate.service'
import { AIModule } from '../ai/ai.module'
import { MediaModule } from '../media/media.module'
import { SettingsModule } from '../settings/settings.module'
import { StorageModule } from '@main/app/modules/google/storage/storage.module'
import { JobLogsModule } from '../job-logs/job-logs.module'
import { UtilModule } from '../util/util.module'
import { SearchModule } from '../search/search.module'

@Module({
  imports: [AIModule, MediaModule, SettingsModule, StorageModule, JobLogsModule, UtilModule, SearchModule],
  providers: [ContentGenerateService],
  exports: [ContentGenerateService],
})
export class ContentGenerateModule {}
