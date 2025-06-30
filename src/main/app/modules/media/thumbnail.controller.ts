import {
  Controller,
  Post,
  Body,
  Get,
  Logger,
  HttpException,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Param,
  Delete,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ThumbnailGeneratorService, ThumbnailOptions } from './thumbnail-generator.service'
import { GCSUploadService } from './gcs-upload.service'
import { SettingsService } from '../settings/settings.service'
import * as crypto from 'crypto'

export interface GenerateThumbnailRequest {
  title: string
  subtitle?: string
  uploadToGCS?: boolean
  backgroundImageFileName?: string
}

interface ThumbnailResponse {
  success: boolean
  imageUrl?: string
  base64?: string
  fileName?: string
  error?: string
}

interface BackgroundImageInfo {
  fileName: string
  filePath: string
}

interface ThumbnailLayoutElement {
  id: string
  type: 'title' | 'subtitle'
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontFamily: string
  color: string
  textAlign: 'left' | 'center' | 'right'
  fontWeight: 'normal' | 'bold'
  opacity: number
  rotation: number
  zIndex: number
}

interface ThumbnailLayoutData {
  id: string
  backgroundImage: string
  elements: ThumbnailLayoutElement[]
  createdAt: string
  updatedAt: string
}

interface GenerateThumbnailWithLayoutRequest {
  backgroundImageFileName: string
  layout: ThumbnailLayoutData
  uploadToGCS?: boolean
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
      const { title, subtitle, uploadToGCS = true, backgroundImageFileName } = request

      if (!title || title.trim().length === 0) {
        throw new HttpException('제목은 필수입니다.', HttpStatus.BAD_REQUEST)
      }

      // 설정 값 가져오기
      const appSettings = await this.settings.getAppSettings()

      // 썸네일 생성이 비활성화된 경우
      if (!appSettings.thumbnailEnabled) {
        throw new HttpException('썸네일 생성이 비활성화되어 있습니다.', HttpStatus.BAD_REQUEST)
      }

      // 배경이미지 경로 설정
      let backgroundImagePath: string | undefined
      if (backgroundImageFileName) {
        backgroundImagePath = this.thumbnailGenerator.getBackgroundImagePath(backgroundImageFileName)
      }

      // 썸네일 생성 옵션 설정
      const thumbnailOptions: ThumbnailOptions = {
        title: title.trim(),
        subtitle: subtitle?.trim(),
        backgroundImagePath,
        textColor: appSettings.thumbnailTextColor || '#ffffff',
        fontSize: appSettings.thumbnailFontSize || 48,
        fontFamily: appSettings.thumbnailFontFamily || 'BMDOHYEON',
      }

      // 썸네일 생성
      const imageBuffer = await this.thumbnailGenerator.generateThumbnail(thumbnailOptions)

      // GCS 업로드 여부 확인
      if (uploadToGCS && appSettings.gcsProjectId && appSettings.gcsKeyContent && appSettings.gcsBucketName) {
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

      if (!appSettings.gcsProjectId || !appSettings.gcsKeyContent || !appSettings.gcsBucketName) {
        return {
          success: false,
          error: 'GCS 설정이 완료되지 않았습니다.',
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
      const { title, subtitle, backgroundImageFileName } = request

      if (!title || title.trim().length === 0) {
        throw new HttpException('제목은 필수입니다.', HttpStatus.BAD_REQUEST)
      }

      // 설정 값 가져오기
      const appSettings = await this.settings.getAppSettings()

      // 배경이미지 경로 설정
      let backgroundImagePath: string | undefined
      if (backgroundImageFileName) {
        backgroundImagePath = this.thumbnailGenerator.getBackgroundImagePath(backgroundImageFileName)
      }

      // 썸네일 생성 옵션 설정
      const thumbnailOptions: ThumbnailOptions = {
        title: title.trim(),
        subtitle: subtitle?.trim(),
        backgroundImagePath,
        textColor: appSettings.thumbnailTextColor || '#ffffff',
        fontSize: appSettings.thumbnailFontSize || 48,
        fontFamily: appSettings.thumbnailFontFamily || 'BMDOHYEON',
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

  @Post('background/upload')
  @UseInterceptors(FileInterceptor('backgroundImage'))
  async uploadBackgroundImage(
    @UploadedFile() file: any,
  ): Promise<{ success: boolean; fileName?: string; error?: string }> {
    try {
      if (!file) {
        throw new HttpException('이미지 파일이 필요합니다.', HttpStatus.BAD_REQUEST)
      }

      // 파일 형식 검증
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg']
      if (!allowedTypes.includes(file.mimetype)) {
        throw new HttpException('PNG, JPG, JPEG 파일만 업로드 가능합니다.', HttpStatus.BAD_REQUEST)
      }

      // 파일 크기 검증 (10MB 제한)
      if (file.size > 10 * 1024 * 1024) {
        throw new HttpException('파일 크기는 10MB를 초과할 수 없습니다.', HttpStatus.BAD_REQUEST)
      }

      // 고유한 파일명 생성
      const hash = crypto.randomBytes(8).toString('hex')
      const ext = file.originalname.split('.').pop()?.toLowerCase() || 'png'
      const fileName = `background_${hash}.${ext}`

      // 파일 저장
      const savedPath = await this.thumbnailGenerator.saveBackgroundImage(file.buffer, fileName)

      this.logger.log(`배경이미지 업로드 완료: ${fileName}`)

      return {
        success: true,
        fileName,
      }
    } catch (error) {
      this.logger.error('배경이미지 업로드 실패:', error)

      return {
        success: false,
        error: error.message || '배경이미지 업로드 중 오류가 발생했습니다.',
      }
    }
  }

  @Get('background/list')
  async getBackgroundImages(): Promise<{ success: boolean; images?: BackgroundImageInfo[]; error?: string }> {
    try {
      const fileNames = this.thumbnailGenerator.getBackgroundImages()

      const images: BackgroundImageInfo[] = fileNames.map(fileName => ({
        fileName,
        filePath: this.thumbnailGenerator.getBackgroundImagePath(fileName),
      }))

      return {
        success: true,
        images,
      }
    } catch (error) {
      this.logger.error('배경이미지 목록 조회 실패:', error)

      return {
        success: false,
        error: error.message || '배경이미지 목록 조회 중 오류가 발생했습니다.',
      }
    }
  }

  @Get('background/:fileName')
  async getBackgroundImage(
    @Param('fileName') fileName: string,
  ): Promise<{ success: boolean; base64?: string; error?: string }> {
    try {
      if (!fileName) {
        throw new HttpException('파일명이 필요합니다.', HttpStatus.BAD_REQUEST)
      }

      const imagePath = this.thumbnailGenerator.getBackgroundImagePath(fileName)

      if (!require('fs').existsSync(imagePath)) {
        return {
          success: false,
          error: '파일을 찾을 수 없습니다.',
        }
      }

      const imageBuffer = require('fs').readFileSync(imagePath)
      const base64 = imageBuffer.toString('base64')
      const ext = fileName.split('.').pop()?.toLowerCase() || 'png'
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'

      return {
        success: true,
        base64: `data:${mimeType};base64,${base64}`,
      }
    } catch (error) {
      this.logger.error('배경이미지 조회 실패:', error)

      return {
        success: false,
        error: error.message || '배경이미지 조회 중 오류가 발생했습니다.',
      }
    }
  }

  @Delete('background/:fileName')
  async deleteBackgroundImage(@Param('fileName') fileName: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!fileName) {
        throw new HttpException('파일명이 필요합니다.', HttpStatus.BAD_REQUEST)
      }

      const deleted = this.thumbnailGenerator.deleteBackgroundImage(fileName)

      if (deleted) {
        this.logger.log(`배경이미지 삭제 완료: ${fileName}`)
        return {
          success: true,
        }
      } else {
        return {
          success: false,
          error: '파일을 찾을 수 없습니다.',
        }
      }
    } catch (error) {
      this.logger.error('배경이미지 삭제 실패:', error)

      return {
        success: false,
        error: error.message || '배경이미지 삭제 중 오류가 발생했습니다.',
      }
    }
  }

  @Post('layout/generate')
  async generateThumbnailWithLayout(@Body() request: GenerateThumbnailWithLayoutRequest): Promise<ThumbnailResponse> {
    try {
      const { backgroundImageFileName, layout, uploadToGCS = true } = request

      if (!backgroundImageFileName) {
        throw new HttpException('배경이미지가 필요합니다.', HttpStatus.BAD_REQUEST)
      }

      if (!layout || !layout.elements || layout.elements.length === 0) {
        throw new HttpException('레이아웃 요소가 필요합니다.', HttpStatus.BAD_REQUEST)
      }

      // 배경이미지 경로 설정
      const backgroundImagePath = this.thumbnailGenerator.getBackgroundImagePath(backgroundImageFileName)

      // 레이아웃 생성을 위한 썸네일 생성기 호출 (새로운 메서드 필요)
      const imageBuffer = await this.thumbnailGenerator.generateThumbnailWithLayout(backgroundImagePath, layout)

      // 설정 값 가져오기 (GCS 업로드용)
      const appSettings = await this.settings.getAppSettings()

      // GCS 업로드 여부 확인
      if (uploadToGCS && appSettings.gcsProjectId && appSettings.gcsKeyContent && appSettings.gcsBucketName) {
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
      this.logger.error('레이아웃 썸네일 생성 실패:', error)

      return {
        success: false,
        error: error.message || '레이아웃 썸네일 생성 중 오류가 발생했습니다.',
      }
    }
  }

  @Post('layout/preview')
  async previewThumbnailWithLayout(@Body() request: GenerateThumbnailWithLayoutRequest): Promise<ThumbnailResponse> {
    try {
      const { backgroundImageFileName, layout } = request

      if (!backgroundImageFileName) {
        throw new HttpException('배경이미지가 필요합니다.', HttpStatus.BAD_REQUEST)
      }

      if (!layout || !layout.elements || layout.elements.length === 0) {
        throw new HttpException('레이아웃 요소가 필요합니다.', HttpStatus.BAD_REQUEST)
      }

      // 배경이미지 경로 설정
      const backgroundImagePath = this.thumbnailGenerator.getBackgroundImagePath(backgroundImageFileName)

      // 레이아웃 생성을 위한 썸네일 생성기 호출
      const imageBuffer = await this.thumbnailGenerator.generateThumbnailWithLayout(backgroundImagePath, layout)
      const base64 = imageBuffer.toString('base64')

      return {
        success: true,
        base64: `data:image/png;base64,${base64}`,
      }
    } catch (error) {
      this.logger.error('레이아웃 썸네일 미리보기 생성 실패:', error)

      return {
        success: false,
        error: error.message || '레이아웃 썸네일 미리보기 생성 중 오류가 발생했습니다.',
      }
    }
  }
}
