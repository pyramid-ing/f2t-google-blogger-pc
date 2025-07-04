import axios from 'axios'

const API_BASE_URL = 'http://localhost:3554'

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 응답 인터셉터 추가
api.interceptors.response.use(
  response => response,
  error => {
    // 에러 응답 처리
    if (error.response) {
      // 서버가 응답을 반환한 경우
      console.error('API Error:', error.response.data)
      return Promise.reject(error.response.data)
    } else if (error.request) {
      // 요청은 보냈지만 응답을 받지 못한 경우
      console.error('Network Error:', error.request)
      return Promise.reject({ message: '서버와 통신할 수 없습니다.' })
    } else {
      // 요청 설정 중 오류가 발생한 경우
      console.error('Request Error:', error.message)
      return Promise.reject({ message: '요청 중 오류가 발생했습니다.' })
    }
  },
)
