import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { SettingsService } from '../settings/settings.service'

@Injectable()
export class ImagePixabayService {
  private readonly logger = new Logger(ImagePixabayService.name)

  constructor(private readonly settingsService: SettingsService) {}

  private async getPixabayApiKey(): Promise<string> {
    const settings = await this.settingsService.getAppSettings()
    const apiKey = settings.pixabayApiKey

    if (!apiKey) {
      throw new Error('Pixabay API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.')
    }

    return apiKey
  }

  async searchImage(keyword: string): Promise<string> {
    this.logger.log(`이미지 검색: ${keyword}`)

    const pixabayApiKey = await this.getPixabayApiKey()
    const response = await axios.get('https://pixabay.com/api/', {
      params: {
        key: pixabayApiKey,
        q: keyword,
        image_type: 'photo',
        orientation: 'horizontal',
        safesearch: true,
        per_page: 3,
      },
    })

    if (!response.data.hits?.length) {
      throw new Error(`이미지를 찾을 수 없습니다: ${keyword}`)
    }

    // 첫 번째 이미지의 URL 반환
    return response.data.hits[0].largeImageURL
  }
}
