export enum ErrorCode {
  // ✅ 유저 관련 (1000번대)
  USER_NOT_FOUND = 1001,
  USER_DUPLICATE = 1002,
  USER_BANNED = 1003,

  // ✅ 인증 관련 (2000번대)
  AUTH_REQUIRED = 2001,
  TOKEN_EXPIRED = 2002,

  // ✅ 권한 (3000번대)
  NO_PERMISSION = 3001,

  // ✅ 요청 오류 (4000번대)
  INVALID_INPUT = 4001,

  // ✅ 외부 API (5000번대)
  EXTERNAL_API_FAIL = 5001,

  // ✅ 서버 오류 (9000번대)
  INTERNAL_ERROR = 9000,
}
