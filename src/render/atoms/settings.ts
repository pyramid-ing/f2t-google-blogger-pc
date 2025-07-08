import { atom, selector } from 'recoil'
import { AppSettings } from '@render/types/settings'

// 기본 설정값
const defaultSettings: AppSettings = {
  aiProvider: 'openai',
  adEnabled: false,
  thumbnailEnabled: false,
  linkEnabled: false,
  imageType: 'pixabay',
  thumbnailFontSize: 24,
  thumbnailTextColor: '#000000',
  thumbnailFontFamily: 'Arial',
  googleTokenExpiry: 0,
}

// 설정 상태 atom
export const settingsState = atom<AppSettings>({
  key: 'settingsState',
  default: defaultSettings,
})

// 로딩 상태 atom
export const settingsLoadingState = atom<boolean>({
  key: 'settingsLoadingState',
  default: false,
})

// 에러 상태 atom
export const settingsErrorState = atom<string | null>({
  key: 'settingsErrorState',
  default: null,
})

// 설정 저장 중 상태 atom
export const settingsSavingState = atom<boolean>({
  key: 'settingsSavingState',
  default: false,
})

// AI 설정만 선택하는 selector
export const aiSettingsSelector = selector({
  key: 'aiSettingsSelector',
  get: ({ get }) => {
    const settings = get(settingsState)
    return {
      aiProvider: settings.aiProvider,
      openaiApiKey: settings.openaiApiKey,
      geminiApiKey: settings.geminiApiKey,
      perplexityApiKey: settings.perplexityApiKey,
    }
  },
})

// Google 설정만 선택하는 selector
export const googleSettingsSelector = selector({
  key: 'googleSettingsSelector',
  get: ({ get }) => {
    const settings = get(settingsState)
    return {
      oauth2ClientId: settings.oauth2ClientId,
      oauth2ClientSecret: settings.oauth2ClientSecret,
      oauth2AccessToken: settings.oauth2AccessToken,
      oauth2TokenExpiry: settings.oauth2TokenExpiry,
      oauth2RefreshToken: settings.oauth2RefreshToken,
      bloggerBlogId: settings.bloggerBlogId,
      googleAccessToken: settings.googleAccessToken,
      googleRefreshToken: settings.googleRefreshToken,
      googleTokenExpiry: settings.googleTokenExpiry,
    }
  },
})

// 이미지 설정만 선택하는 selector
export const imageSettingsSelector = selector({
  key: 'imageSettingsSelector',
  get: ({ get }) => {
    const settings = get(settingsState)
    return {
      imageType: settings.imageType,
      pixabayApiKey: settings.pixabayApiKey,
      gcsProjectId: settings.gcsProjectId,
      gcsKeyContent: settings.gcsKeyContent,
      gcsBucketName: settings.gcsBucketName,
    }
  },
})

// 썸네일 설정만 선택하는 selector
export const thumbnailSettingsSelector = selector({
  key: 'thumbnailSettingsSelector',
  get: ({ get }) => {
    const settings = get(settingsState)
    return {
      thumbnailEnabled: settings.thumbnailEnabled,
      thumbnailBackgroundImage: settings.thumbnailBackgroundImage,
      thumbnailDefaultLayoutId: settings.thumbnailDefaultLayoutId,
      thumbnailTextColor: settings.thumbnailTextColor,
      thumbnailFontSize: settings.thumbnailFontSize,
      thumbnailFontFamily: settings.thumbnailFontFamily,
    }
  },
})

// 앱 설정만 선택하는 selector
export const appSettingsSelector = selector({
  key: 'appSettingsSelector',
  get: ({ get }) => {
    const settings = get(settingsState)
    return {
      adEnabled: settings.adEnabled,
      adScript: settings.adScript,
      linkEnabled: settings.linkEnabled,
      blogId: settings.blogId,
      blogName: settings.blogName,
      blogUrl: settings.blogUrl,
    }
  },
})
