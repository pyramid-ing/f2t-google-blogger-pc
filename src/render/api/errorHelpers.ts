// ErrorResponse 타입을 직접 정의
export interface ErrorResponse {
  success: false
  statusCode: number
  timestamp: string
  path: string
  error: string
  message: string
  code?: string
  service?: string
  operation?: string
  details?: {
    stack?: string[]
    name?: string
    url?: string
    method?: string
    response?: any
    code?: string
    category?: string
    postData?: any
    ffmpegError?: string
    inputData?: any
    siteUrl?: string
    blogId?: string
    postId?: string
    configType?: string
    isExpired?: boolean
    additionalInfo?: Record<string, any>
  }
}

export function getErrorMessage(error: any): string {
  if (error.response?.data) {
    const errorData = error.response.data as ErrorResponse
    if (errorData.code && errorData.service && errorData.operation) {
      return `[${errorData.service}/${errorData.operation}] ${errorData.message}`
    }
    return errorData.message || error.message
  }
  return error.message || '알 수 없는 오류가 발생했습니다.'
}

export function getErrorDetails(error: any): string | undefined {
  if (error.response?.data?.details?.additionalInfo) {
    const details = error.response.data.details.additionalInfo
    const detailStrings = []
    for (const [key, value] of Object.entries(details)) {
      if (typeof value === 'boolean') {
        detailStrings.push(`${key}: ${value ? '있음' : '없음'}`)
      } else if (typeof value === 'string' || typeof value === 'number') {
        detailStrings.push(`${key}: ${value}`)
      }
    }
    return detailStrings.length > 0 ? detailStrings.join(', ') : undefined
  }
  return undefined
}
