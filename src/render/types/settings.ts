export interface AppSettings {
  // Google OAuth 관련 설정
  oauth2ClientId?: string // OAuth2 Client ID
  oauth2ClientSecret?: string // OAuth2 Client Secret
  oauth2AccessToken?: string
  oauth2TokenExpiry?: string
  oauth2RefreshToken?: string
  bloggerBlogId?: string // 선택된 Blogger 블로그 ID

  // AI 설정
  openaiApiKey?: string // OpenAI API 키

  // 이미지 설정
  imageType?: 'ai' | 'pixabay' // 이미지 생성 방식
  pixabayApiKey?: string // Pixabay API 키
}
