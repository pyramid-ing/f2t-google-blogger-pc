import { Controller, Get } from '@nestjs/common'
import { StorageService } from './storage.service'

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get('test-connection')
  async testConnection() {
    const result = await this.storageService.testConnection()

    if (result.success) {
      return {
        status: 'success',
        message: 'GCS 연결이 정상적으로 수행되었습니다.',
      }
    } else {
      return {
        status: 'error',
        message: 'GCS 연결에 실패했습니다.',
        error: result.error,
      }
    }
  }

  @Get('ensure-bucket')
  async ensureBucket() {
    try {
      await this.storageService.ensureBucketExists()
      return {
        status: 'success',
        message: '버킷이 정상적으로 존재하거나 생성되었습니다.',
      }
    } catch (e) {
      return {
        status: 'error',
        message: '버킷 생성/확인 중 오류 발생',
        error: e?.message,
      }
    }
  }
}
