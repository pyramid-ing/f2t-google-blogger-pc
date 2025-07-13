import type { AppSettings } from '../types/settings'
import { api } from './apiClient'
import { ValidateAIKeyResponseDto } from '@main/app/modules/settings/dto/validate-ai-key.dto'

export async function validatePerplexityApiKey(apiKey: string): Promise<{
  valid: boolean
  error?: string
  model?: string
}> {
  const res = await api.post('/settings/validate-perplexity-key', { apiKey })
  return res.data
}

export const getSettings = async (): Promise<AppSettings> => {
  const response = await api.get('/settings')
  // GCS 버킷 ensure 호출 (에러는 무시)
  try {
    await api.get('/storage/ensure-bucket')
  } catch (e) {
    console.warn('GCS 버킷 ensure 실패:', (e as any)?.message)
  }
  return response.data
}

export const updateSettings = async (settings: Partial<AppSettings>): Promise<AppSettings> => {
  const response = await api.post('/settings', settings)
  // GCS 버킷 ensure 호출 (에러는 무시)
  try {
    await api.get('/storage/ensure-bucket')
  } catch (e) {
    console.warn('GCS 버킷 ensure 실패:', (e as any)?.message)
  }
  return response.data
}

export const validateAIKey = async ({
  provider,
  apiKey,
}: {
  provider: 'openai' | 'gemini' | 'perplexity'
  apiKey: string
}) => {
  const response = await api.post<ValidateAIKeyResponseDto>('/ai/validate-key', {
    provider,
    apiKey,
  })
  return response.data
}
