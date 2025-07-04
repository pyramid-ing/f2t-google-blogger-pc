import { api } from './apiClient'

export async function getBloggerBlogsFromServer() {
  const res = await api.get('/google-blogger/user/blogs')
  return res.data.blogs?.items || []
}

// 토픽 생성 작업 등록 (jobId 반환)
export async function requestFindTopicsJob(topic: string, limit: number = 10) {
  const response = await api.get('/workflow/find-topics', {
    params: { topic, limit },
  })
  return response.data // { success, message, jobId }
}

// jobId로 결과 polling
export async function getFindTopicsJobResult(jobId: string) {
  const response = await api.get(`/api/jobs/${jobId}`)
  return response.data // { status, resultMsg, ... , topicJob: { result: ... } }
}

// 다운로드: 서버에 저장된 xlsx 파일을 다운로드
export async function downloadFindTopicsResult(jobId: string) {
  const response = await api.get(`/topic-job/download-topic-job/${jobId}`, {
    responseType: 'blob',
  })
  return response.data
}
