import { api } from './apiClient'

export async function getBloggerBlogs() {
  const res = await api.get('/google/blogger/blogs')
  return res.data
}

// 다운로드: 서버에 저장된 xlsx 파일을 다운로드
export async function downloadFindTopicsResult(jobId: string) {
  const response = await api.get(`/topic-job/download-topic-job/${jobId}`, {
    responseType: 'blob',
  })
  return response.data
}
