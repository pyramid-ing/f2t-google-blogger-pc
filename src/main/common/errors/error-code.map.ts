import { ErrorCode } from './error-code.enum'

export interface ErrorCodeMeta {
  status: number
  message: (metadata?: Record<string, any>) => string
}

export const ErrorCodeMap: Record<ErrorCode, ErrorCodeMeta> = {
  // 인증 관련
  [ErrorCode.AUTH_REQUIRED]: { status: 401, message: () => '로그인이 필요합니다.' },
  [ErrorCode.TOKEN_EXPIRED]: { status: 401, message: () => '토큰이 만료되었습니다.' },

  // 권한
  [ErrorCode.NO_PERMISSION]: { status: 403, message: () => '권한이 없습니다.' },

  // 유저 관련
  [ErrorCode.USER_NOT_FOUND]: { status: 404, message: () => '사용자를 찾을 수 없습니다.' },
  [ErrorCode.USER_DUPLICATE]: { status: 409, message: () => '이미 존재하는 사용자입니다.' },
  [ErrorCode.USER_BANNED]: { status: 403, message: () => '정지된 계정입니다.' },

  // 요청 오류
  [ErrorCode.INVALID_INPUT]: { status: 400, message: () => '입력값이 유효하지 않습니다.' },
  [ErrorCode.DATA_NOT_FOUND]: { status: 404, message: () => '데이터를 찾을 수 없습니다.' },
  [ErrorCode.VALIDATION_ERROR]: {
    status: 400,
    message: meta => (meta?.details ? `입력값이 유효하지 않습니다. (${meta.details})` : '입력값이 유효하지 않습니다.'),
  },

  // AI 관련
  [ErrorCode.AI_KEY_REQUIRED]: { status: 400, message: () => 'AI 키가 입력되지 않았습니다.' },
  [ErrorCode.AI_KEY_INVALID]: { status: 401, message: () => 'AI 키가 유효하지 않습니다.' },
  [ErrorCode.AI_QUOTA_EXCEEDED]: {
    status: 429,
    message: meta =>
      `AI 할당량이 초과되었습니다.${meta?.retryDelay ? ` ${meta.retryDelay}초 후에 다시 시도해주세요.` : ''}${meta?.provider ? ` (provider: ${meta.provider})` : ''}`,
  },
  [ErrorCode.AI_NO_PERMISSION]: { status: 403, message: () => 'AI 키에 필요한 권한이 없습니다.' },
  [ErrorCode.AI_API_ERROR]: {
    status: 502,
    message: meta =>
      `AI API 호출 중 오류가 발생했습니다.${meta?.provider ? ` (provider: ${meta.provider})` : ''}${meta?.message ? `: ${meta.message}` : ''}`,
  },
  [ErrorCode.INVALID_CLIENT_CREDENTIALS]: {
    status: 401,
    message: () => '클라이언트 ID 또는 시크릿이 잘못되었습니다.',
  },

  // 외부 API
  [ErrorCode.EXTERNAL_API_FAIL]: { status: 502, message: () => '외부 API 호출 실패' },
  [ErrorCode.EXTERNAL_API_NO_RESPONSE]: { status: 504, message: () => '외부 API 응답이 없습니다.' },
  [ErrorCode.EXTERNAL_API_PARSE_ERROR]: { status: 502, message: () => '외부 API 응답 파싱 오류' },

  // GCS/스토리지
  [ErrorCode.GCS_CONFIG_REQUIRED]: { status: 400, message: () => 'GCS 설정이 완료되지 않았습니다.' },
  [ErrorCode.GCS_JSON_PARSE_ERROR]: { status: 400, message: () => 'GCS 서비스 계정 키 JSON 형식이 올바르지 않습니다.' },

  // 서버/기타
  [ErrorCode.INTERNAL_ERROR]: { status: 500, message: () => '서버 내부 오류' },
}
