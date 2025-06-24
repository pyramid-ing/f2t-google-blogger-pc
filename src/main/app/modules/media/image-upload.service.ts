import { Injectable, Logger } from '@nestjs/common'
import { Storage } from '@google-cloud/storage'
import axios from 'axios'
import * as path from 'path'
import * as crypto from 'crypto'

@Injectable()
export class ImageUploadService {
  private readonly logger = new Logger(ImageUploadService.name)
  private readonly storage: Storage
  private readonly bucketName = process.env.GCS_BUCKET_NAME

  constructor() {
    this.storage = new Storage({
      keyFilename: process.env.GCS_KEY_FILE,
    })
  }

  async upload(imageUrl: string): Promise<string> {
    this.logger.log(`이미지 업로드 시작: ${imageUrl}`)

    try {
      // 1. 이미지 다운로드
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
      })

      // 2. 파일명 생성 (해시 + 확장자)
      const ext = path.extname(imageUrl)
      const hash = crypto.createHash('md5').update(imageUrl).digest('hex')
      const filename = `images/${hash}${ext}`

      // 3. GCS에 업로드
      const bucket = this.storage.bucket(this.bucketName)
      const file = bucket.file(filename)

      await file.save(response.data, {
        contentType: response.headers['content-type'],
        public: true,
      })

      // 4. 공개 URL 반환
      return `https://storage.googleapis.com/${this.bucketName}/${filename}`
    } catch (error) {
      this.logger.error('이미지 업로드 실패:', error)
      throw error
    }
  }
}
