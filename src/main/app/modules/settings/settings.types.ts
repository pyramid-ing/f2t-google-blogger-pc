export type AIProvider = 'gemini'

export interface AppSettings {
  // AI 설정
  aiProvider: AIProvider
  geminiApiKey?: string

  // 이미지 설정
  imageType?: 'ai' | 'pixabay' | 'none' // 이미지 생성 방식 (none: 사용안함)
  pixabayApiKey?: string // Pixabay API 키

  // 게시 설정
  publishType: 'google' | 'tistory' // 블로그 게시 및 이미지 업로드 대상

  // 썸네일 설정
  thumbnailEnabled?: boolean // 썸네일 생성 활성화 여부
  thumbnailBackgroundImage?: string // 썸네일 배경이미지 파일명 (deprecated)
  thumbnailDefaultLayoutId?: string // 기본 썸네일 레이아웃 ID
  thumbnailTextColor?: string // 썸네일 텍스트 색상
  thumbnailFontSize?: number // 썸네일 폰트 크기
  thumbnailFontFamily?: string // 썸네일 폰트 패밀리

  // GCS 설정
  gcsKeyContent?: string // GCS 서비스 계정 키 JSON 내용
  gcsBucketName?: string // GCS 버킷명

  // 광고 설정
  adEnabled?: boolean // 광고 활성화 여부
  adScript?: string // 광고 스크립트 코드

  // 링크 설정
  linkEnabled?: boolean // 링크 활성화 여부
  youtubeEnabled?: boolean // 유튜브 링크 활성화 여부
}
