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

export async function saveAppSettingsToServer(settings: AppSettings) {
  const res = await api.post('/settings/app', settings)
  return res.data
}

export async function getAppSettingsFromServer(): Promise<AppSettings> {
  const res = await api.get('/settings/app')
  return res.data?.data
}
