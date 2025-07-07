import { api } from './apiClient'

export async function testGoogleStorgeConnection(): Promise<{ success: boolean; error?: string }> {
  const response = await api.get('/storage/test-connection')
  return response.data
}
