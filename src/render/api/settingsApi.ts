import type { AppSettings } from '../types/settings'
import { api } from './apiClient'

export async function saveOpenAIApiKeyToServer(key: string) {
  const res = await api.post('/settings/global', { openAIApiKey: key })
  return res.data
}

export async function getOpenAIApiKeyFromServer(): Promise<string> {
  const res = await api.get('/settings/global')
  return res.data?.data?.openAIApiKey || ''
}

export async function validateOpenAIApiKey(apiKey: string): Promise<{
  valid: boolean
  error?: string
  model?: string
}> {
  const res = await api.post('/settings/validate-openai-key', { apiKey })
  return res.data
}

export async function validatePerplexityApiKey(apiKey: string): Promise<{
  valid: boolean
  error?: string
  model?: string
}> {
  const res = await api.post('/settings/validate-perplexity-key', { apiKey })
  return res.data
}

export async function saveAppSettingsToServer(settings: AppSettings) {
  const res = await api.post('/settings/app', settings)
  return res.data
}

export async function getAppSettingsFromServer(): Promise<AppSettings> {
  const res = await api.get('/settings/app')
  return res.data?.data
}

export const getSettings = async (): Promise<AppSettings> => {
  const response = await api.get('/settings')
  return response.data
}

export const updateSettings = async (settings: Partial<AppSettings>): Promise<AppSettings> => {
  const response = await api.post('/settings', settings)
  return response.data
}

export const validateAIKey = async ({
  provider,
  apiKey,
}: {
  provider: string
  apiKey: string
}): Promise<{ valid: boolean; error?: string }> => {
  const response = await api.post('/settings/validate-ai-key', { provider, apiKey })
  return response.data
}

export const settingsApi = {
  // 설정 조회
  getSettings: async (): Promise<AppSettings> => {
    const response = await api.get('/settings')
    return response.data
  },

  // 설정 저장
  saveSettings: async (settings: AppSettings): Promise<AppSettings> => {
    const response = await api.put('/settings', settings)
    return response.data
  },

  // AI API 키 검증
  validateAIKey: async (
    provider: 'openai' | 'gemini',
    apiKey: string,
  ): Promise<{ valid: boolean; error?: string; model?: string }> => {
    const response = await api.post(`/settings/validate-${provider}-key`, { apiKey })
    return response.data
  },
}
