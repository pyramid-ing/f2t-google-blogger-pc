import { atom } from 'recoil'
import { AppSettings } from '@render/types/settings'

export interface Settings {
  aiProvider: 'openai' | 'gemini'
  openaiApiKey?: string
  geminiApiKey?: string
  perplexityApiKey?: string
  // ... 기존 설정들
}

export const settingsState = atom<AppSettings>({
  key: 'settingsState',
  default: {
    aiProvider: 'openai',
  },
})
