import { api } from './apiClient'

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

export const thumbnailApi = {
  // 썸네일 생성
  generateThumbnail: async (request: GenerateThumbnailRequest): Promise<ThumbnailResponse> => {
    const response = await api.post('/api/thumbnail/generate', request)
    return response.data
  },

  // 썸네일 미리보기 생성
  previewThumbnail: async (request: GenerateThumbnailRequest): Promise<ThumbnailResponse> => {
    const response = await api.post('/api/thumbnail/preview', request)
    return response.data
  },

  // GCS 연결 테스트
  testGCSConnection: async (): Promise<{ success: boolean; error?: string }> => {
    const response = await api.get('/api/thumbnail/test-gcs')
    return response.data
  },
}
