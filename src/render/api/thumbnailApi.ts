import { api } from './apiClient'

export interface GenerateThumbnailRequest {
  title: string
  subtitle?: string
  uploadToGCS?: boolean
  backgroundImageFileName?: string
}

export interface ThumbnailResponse {
  success: boolean
  imageUrl?: string
  base64?: string
  fileName?: string
  error?: string
}

export interface BackgroundImageInfo {
  fileName: string
  filePath: string
  base64?: string
}

export interface ThumbnailLayoutElement {
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

export interface ThumbnailLayoutData {
  id: string
  backgroundImage: string
  elements: ThumbnailLayoutElement[]
  createdAt: string
  updatedAt: string
}

export interface ThumbnailLayoutGenerateRequest {
  backgroundImageFileName: string
  layout: ThumbnailLayoutData
  uploadToGCS?: boolean
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

  // 배경이미지 업로드
  uploadBackgroundImage: async (file: File): Promise<{ success: boolean; fileName?: string; error?: string }> => {
    const formData = new FormData()
    formData.append('backgroundImage', file)

    const response = await api.post('/api/thumbnail/background/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  // 배경이미지 목록 조회
  getBackgroundImages: async (): Promise<{ success: boolean; images?: BackgroundImageInfo[]; error?: string }> => {
    const response = await api.get('/api/thumbnail/background/list')
    return response.data
  },

  // 배경이미지 조회 (base64)
  getBackgroundImage: async (fileName: string): Promise<{ success: boolean; base64?: string; error?: string }> => {
    const response = await api.get(`/api/thumbnail/background/${fileName}`)
    return response.data
  },

  // 배경이미지 삭제
  deleteBackgroundImage: async (fileName: string): Promise<{ success: boolean; error?: string }> => {
    const response = await api.delete(`/api/thumbnail/background/${fileName}`)
    return response.data
  },

  // 레이아웃 기반 썸네일 생성
  generateThumbnailWithLayout: async (request: ThumbnailLayoutGenerateRequest): Promise<ThumbnailResponse> => {
    const response = await api.post('/api/thumbnail/layout/generate', request)
    return response.data
  },

  // 레이아웃 기반 썸네일 미리보기
  previewThumbnailWithLayout: async (request: ThumbnailLayoutGenerateRequest): Promise<ThumbnailResponse> => {
    const response = await api.post('/api/thumbnail/layout/preview', request)
    return response.data
  },
}
