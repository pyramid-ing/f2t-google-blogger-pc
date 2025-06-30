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
  perplexityApiKey?: string // Perplexity API 키

  // 이미지 설정
  imageType?: 'ai' | 'pixabay' | 'none' // 이미지 생성 방식 (none: 사용안함)
  pixabayApiKey?: string // Pixabay API 키

  // 썸네일 설정
  thumbnailEnabled?: boolean // 썸네일 생성 활성화 여부
  thumbnailBackgroundColor?: string // 썸네일 배경색
  thumbnailTextColor?: string // 썸네일 텍스트 색상
  thumbnailFontSize?: number // 썸네일 폰트 크기
  thumbnailWidth?: number // 썸네일 너비
  thumbnailHeight?: number // 썸네일 높이
  thumbnailFontFamily?: string // 썸네일 폰트 패밀리

  // GCS 설정
  gcsEnabled?: boolean // GCS 업로드 활성화 여부
  gcsProjectId?: string // GCS 프로젝트 ID
  gcsKeyContent?: string // GCS 서비스 계정 키 JSON 내용
  gcsBucketName?: string // GCS 버킷명

  // 광고 설정
  adEnabled?: boolean // 광고 활성화 여부
  adScript?: string // 광고 스크립트 코드
}
