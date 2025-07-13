import { Injectable, Logger } from '@nestjs/common'
import { Storage } from '@google-cloud/storage'
import { SettingsService } from '../../settings/settings.service'

const GCS_BUCKET_NAME = 'winsoft-blog'

export interface StorageUploadOptions {
  fileName?: string
  contentType?: string
  isPublic?: boolean
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)

  constructor(private readonly settingsService: SettingsService) {}

  private async initializeStorage(): Promise<Storage> {
    const settings = await this.settingsService.getSettings()

    if (!settings.gcsKeyContent) {
      throw new Error('GCS 설정이 완료되지 않았습니다. 서비스 계정 키 JSON을 확인해주세요.')
    }

    try {
      // JSON 문자열을 파싱하여 자격 증명으로 사용
      const credentials = JSON.parse(settings.gcsKeyContent)

      return new Storage({
        credentials,
        projectId: credentials.project_id,
      })
    } catch (error) {
      this.logger.error('GCS 초기화 실패:', error)
      if (error instanceof SyntaxError) {
        throw new Error('GCS 서비스 계정 키 JSON 형식이 올바르지 않습니다. JSON 형식을 확인해주세요.')
      }
      throw new Error(`GCS 초기화 실패: ${error.message}`)
    }
  }

  async uploadImage(
    imageBuffer: Buffer,
    options: StorageUploadOptions = {},
  ): Promise<{ url: string; fileName: string }> {
    const { fileName, contentType = 'image/png', isPublic = true } = options

    try {
      const storage = await this.initializeStorage()
      const settings = await this.settingsService.getSettings()
      const bucket = storage.bucket(GCS_BUCKET_NAME)

      // 파일명 생성 (제공되지 않은 경우 자동 생성)
      const finalFileName = fileName
      const file = bucket.file(finalFileName)

      // 업로드 스트림 생성 (Uniform bucket-level access 호환)
      const stream = file.createWriteStream({
        metadata: {
          contentType,
          cacheControl: 'public, max-age=86400', // 1일 캐시
        },
        validation: 'md5',
      })

      return new Promise((resolve, reject) => {
        stream.on('error', error => {
          this.logger.error('GCS 업로드 실패:', error)
          reject(new Error(`이미지 업로드 실패: ${error.message}`))
        })

        stream.on('finish', async () => {
          try {
            // 항상 공개 URL 사용 (블로그 이미지용)
            const publicUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${finalFileName}`

            // 파일을 공개로 설정
            try {
              await file.makePublic()
              this.logger.log(`파일 공개 설정 완료: ${finalFileName}`)
            } catch (makePublicError) {
              this.logger.warn(`파일 공개 설정 실패 (버킷이 이미 공개이거나 권한 부족): ${makePublicError.message}`)
              // 실패해도 계속 진행 (버킷이 이미 공개일 수 있음)
            }

            this.logger.log(`이미지 업로드 성공: ${publicUrl}`)
            resolve({
              url: publicUrl,
              fileName: finalFileName,
            })
          } catch (error) {
            this.logger.error('공개 URL 생성 실패:', error)
            reject(new Error(`공개 URL 생성 실패: ${error.message}`))
          }
        })

        // 버퍼 데이터를 스트림에 쓰기
        stream.end(imageBuffer)
      })
    } catch (error) {
      this.logger.error('GCS 업로드 중 오류:', error)
      throw error
    }
  }

  async deleteImage(fileName: string): Promise<void> {
    try {
      const storage = await this.initializeStorage()
      const settings = await this.settingsService.getSettings()
      const bucket = storage.bucket(GCS_BUCKET_NAME)
      const file = bucket.file(fileName)

      await file.delete()
      this.logger.log(`이미지 삭제 성공: ${fileName}`)
    } catch (error) {
      this.logger.error('GCS 이미지 삭제 실패:', error)
      throw new Error(`이미지 삭제 실패: ${error.message}`)
    }
  }

  private getExtensionFromContentType(contentType: string): string {
    const typeMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
    }

    return typeMap[contentType.toLowerCase()] || 'png'
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const storage = await this.initializeStorage()
      const settings = await this.settingsService.getSettings()
      const bucket = storage.bucket(GCS_BUCKET_NAME)

      // 버킷 존재 여부 확인
      const [exists] = await bucket.exists()

      if (!exists) {
        return {
          success: false,
          error: `버킷 '${GCS_BUCKET_NAME}'이 존재하지 않습니다.`,
        }
      }

      return { success: true }
    } catch (error) {
      this.logger.error('GCS 연결 테스트 실패:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * 버킷이 존재하지 않으면 생성하고, 이미 있으면 아무 작업도 하지 않음
   */
  async ensureBucketExists(): Promise<void> {
    const BUCKET_NAME = GCS_BUCKET_NAME
    const LOCATION = 'asia-northeast3'
    const STORAGE_CLASS = 'STANDARD'
    try {
      const storage = await this.initializeStorage()
      const [bucketExists] = await storage.bucket(BUCKET_NAME).exists()
      if (bucketExists) {
        this.logger.log(`버킷 '${BUCKET_NAME}' 이미 존재합니다.`)
        return
      }
      // 버킷 생성
      await storage.createBucket(BUCKET_NAME, {
        location: LOCATION,
        storageClass: STORAGE_CLASS,
        uniformBucketLevelAccess: true,
      })
      this.logger.log(`버킷 '${BUCKET_NAME}' 생성 완료`)
      // 공개 권한 부여
      await storage.bucket(BUCKET_NAME).iam.setPolicy({
        bindings: [
          {
            role: 'roles/storage.objectViewer',
            members: ['allUsers'],
          },
        ],
      })
      this.logger.log(`버킷 '${BUCKET_NAME}'에 공개 권한 부여 완료`)
    } catch (error) {
      this.logger.error('버킷 생성/권한 부여 중 오류:', error)
      throw new Error(`버킷 생성/권한 부여 실패: ${error.message}`)
    }
  }
}
