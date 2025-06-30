import { Controller, Post, Body, Get, Logger, HttpException, HttpStatus } from '@nestjs/common'
import { ThumbnailGeneratorService, ThumbnailOptions } from './thumbnail-generator.service'
import { GCSUploadService } from './gcs-upload.service'
import { SettingsService } from '../settings/settings.service'

export interface GenerateThumbnailRequest {
  title: string
  subtitle?: string
  uploadToGCS?: boolean
}

export interface ThumbnailResponse {
  success: boolean
  imageUrl?: string
  fileName?: string
  base64?: string
  error?: string
}

@Controller('api/thumbnail')
export class ThumbnailController {
  private readonly logger = new Logger(ThumbnailController.name)

  constructor(
    private readonly thumbnailGenerator: ThumbnailGeneratorService,
    private readonly gcsUpload: GCSUploadService,
    private readonly settings: SettingsService,
  ) {}

  @Post('generate')
  async generateThumbnail(@Body() request: GenerateThumbnailRequest): Promise<ThumbnailResponse> {
    try {
      const { title, subtitle, uploadToGCS = true } = request

      if (!title || title.trim().length === 0) {
        throw new HttpException('제목은 필수입니다.', HttpStatus.BAD_REQUEST)
      }

      // 설정 값 가져오기
      const appSettings = await this.settings.getAppSettings()

      // 썸네일 생성 설정 확인
      if (!appSettings.thumbnailEnabled) {
        throw new HttpException('썸네일 생성이 비활성화되어 있습니다.', HttpStatus.BAD_REQUEST)
      }

      // 썸네일 생성 옵션 설정
      const thumbnailOptions: ThumbnailOptions = {
        title: title.trim(),
        subtitle: subtitle?.trim(),
        backgroundColor: appSettings.thumbnailBackgroundColor || '#4285f4',
        textColor: appSettings.thumbnailTextColor || '#ffffff',
        fontSize: appSettings.thumbnailFontSize || 48,
        width: appSettings.thumbnailWidth || 1200,
        height: appSettings.thumbnailHeight || 630,
        fontFamily: appSettings.thumbnailFontFamily || 'Arial, sans-serif',
      }

      // 썸네일 생성
      const imageBuffer = await this.thumbnailGenerator.generateThumbnail(thumbnailOptions)

      // GCS 업로드 여부 확인
      if (uploadToGCS && appSettings.gcsEnabled) {
        try {
          const uploadResult = await this.gcsUpload.uploadImage(imageBuffer, {
            contentType: 'image/png',
            isPublic: true,
          })

          return {
            success: true,
            imageUrl: uploadResult.url,
            fileName: uploadResult.fileName,
          }
        } catch (uploadError) {
          this.logger.error('GCS 업로드 실패, base64로 응답:', uploadError)

          // GCS 업로드 실패 시 base64로 응답
          const base64 = imageBuffer.toString('base64')
          return {
            success: true,
            base64: `data:image/png;base64,${base64}`,
            error: `GCS 업로드 실패: ${uploadError.message}`,
          }
        }
      } else {
        // GCS 업로드 안 함 - base64로 응답
        const base64 = imageBuffer.toString('base64')
        return {
          success: true,
          base64: `data:image/png;base64,${base64}`,
        }
      }
    } catch (error) {
      this.logger.error('썸네일 생성 실패:', error)

      return {
        success: false,
        error: error.message || '썸네일 생성 중 오류가 발생했습니다.',
      }
    }
  }

  @Get('test-gcs')
  async testGCSConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const appSettings = await this.settings.getAppSettings()

      if (!appSettings.gcsEnabled) {
        return {
          success: false,
          error: 'GCS가 비활성화되어 있습니다.',
        }
      }

      return await this.gcsUpload.testConnection()
    } catch (error) {
      this.logger.error('GCS 연결 테스트 실패:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  @Post('preview')
  async previewThumbnail(@Body() request: GenerateThumbnailRequest): Promise<ThumbnailResponse> {
    try {
      const { title, subtitle } = request

      if (!title || title.trim().length === 0) {
        throw new HttpException('제목은 필수입니다.', HttpStatus.BAD_REQUEST)
      }

      // 설정 값 가져오기
      const appSettings = await this.settings.getAppSettings()

      // 썸네일 생성 옵션 설정
      const thumbnailOptions: ThumbnailOptions = {
        title: title.trim(),
        subtitle: subtitle?.trim(),
        backgroundColor: appSettings.thumbnailBackgroundColor || '#4285f4',
        textColor: appSettings.thumbnailTextColor || '#ffffff',
        fontSize: appSettings.thumbnailFontSize || 48,
        width: appSettings.thumbnailWidth || 1200,
        height: appSettings.thumbnailHeight || 630,
        fontFamily: appSettings.thumbnailFontFamily || 'Arial, sans-serif',
      }

      // 썸네일 생성 (업로드 없이 미리보기용)
      const imageBuffer = await this.thumbnailGenerator.generateThumbnail(thumbnailOptions)
      const base64 = imageBuffer.toString('base64')

      return {
        success: true,
        base64: `data:image/png;base64,${base64}`,
      }
    } catch (error) {
      this.logger.error('썸네일 미리보기 생성 실패:', error)

      return {
        success: false,
        error: error.message || '썸네일 미리보기 생성 중 오류가 발생했습니다.',
      }
    }
  }
}
