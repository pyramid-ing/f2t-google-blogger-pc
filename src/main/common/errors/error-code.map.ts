import { ErrorCode } from './error-code.enum'

export interface ErrorCodeMeta {
  status: number
  message: string
}

export const ErrorCodeMap: Record<ErrorCode, ErrorCodeMeta> = {
  // 인증 관련
  [ErrorCode.AUTH_REQUIRED]: { status: 401, message: '로그인이 필요합니다.' },
  [ErrorCode.TOKEN_EXPIRED]: { status: 401, message: '토큰이 만료되었습니다.' },

  // 권한
  [ErrorCode.NO_PERMISSION]: { status: 403, message: '권한이 없습니다.' },

  // 유저 관련
  [ErrorCode.USER_NOT_FOUND]: { status: 404, message: '사용자를 찾을 수 없습니다.' },
  [ErrorCode.USER_DUPLICATE]: { status: 409, message: '이미 존재하는 사용자입니다.' },
  [ErrorCode.USER_BANNED]: { status: 403, message: '정지된 계정입니다.' },

  // 요청 오류
  [ErrorCode.INVALID_INPUT]: { status: 400, message: '입력값이 유효하지 않습니다.' },

  // 서버/기타
  [ErrorCode.EXTERNAL_API_FAIL]: { status: 502, message: '외부 API 호출 실패' },
  [ErrorCode.INTERNAL_ERROR]: { status: 500, message: '서버 내부 오류' },
}
