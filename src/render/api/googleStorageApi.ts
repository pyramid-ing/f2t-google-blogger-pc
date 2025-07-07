import { api } from './apiClient'

interface GCSTestResponse {
  status: 'success' | 'error'
  message: string
  error?: string
}

export async function testGoogleStorgeConnection(): Promise<GCSTestResponse> {
  const response = await api.get('/storage/test-connection')
  return response.data
}
