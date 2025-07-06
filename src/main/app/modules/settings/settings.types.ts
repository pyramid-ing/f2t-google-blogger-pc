export type AIProvider = 'openai' | 'gemini'

export interface ValidateAIKeyDto {
  provider: AIProvider
  apiKey: string
}

export interface AppSettings {
  // Google OAuth 관련 설정
  oauth2ClientId?: string
  oauth2ClientSecret?: string
  oauth2AccessToken?: string
  oauth2TokenExpiry?: string
  oauth2RefreshToken?: string
  bloggerBlogId?: string

  // AI 설정
  aiProvider: AIProvider
  openaiApiKey?: string
  geminiApiKey?: string
  perplexityApiKey?: string

  // 이미지 설정
  imageType?: 'ai' | 'pixabay' | 'none'
  pixabayApiKey?: string

  // 썸네일 설정
  thumbnailEnabled?: boolean
  thumbnailBackgroundImage?: string
  thumbnailDefaultLayoutId?: string
  thumbnailTextColor?: string
  thumbnailFontSize?: number
  thumbnailFontFamily?: string

  // GCS 설정
  gcsProjectId?: string
  gcsKeyContent?: string
  gcsBucketName?: string

  // 광고 설정
  adEnabled?: boolean
  adScript?: string

  // 기존 설정들
  blogId?: string
  blogName?: string
  blogUrl?: string
  googleAccessToken?: string
  googleRefreshToken?: string
  googleTokenExpiry?: number
}
