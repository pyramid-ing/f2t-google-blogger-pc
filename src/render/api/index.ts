// 도메인별 API export만 남기고, 기존 함수 구현은 모두 제거합니다.
export * from './apiClient'
export * from './errorHelpers'
export * from './bloggerApi'
export * from './googleOAuthApi'
export * from './settingsApi'
export * from './thumbnailApi'
export * from './workflowApi'
export * from './jobApi'

export const JOB_TYPE = {
  POST: 'post',
  GENERATE_TOPIC: 'generate_topic',
} as const

export const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export type JobType = (typeof JOB_TYPE)[keyof typeof JOB_TYPE]
export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS]

export interface TopicJobDetail {
  id: string
  jobId: string
  topic: string
  limit: number
  result: { title: string; content: string }[] | null
  status: string
  createdAt: string
  updatedAt: string
  xlsxFileName: string | null
}

export interface BlogJobDetail {
  id: string
  jobId: string
  title: string
  content: string
  status: string
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface BaseJob {
  id: string
  type: JobType
  subject: string
  desc: string
  status: JobStatus
  priority: number
  scheduledAt: string
  startedAt?: string
  completedAt?: string
  loginId: string
  resultMsg?: string
  resultUrl?: string
  errorMessage?: string
  createdAt: string
  updatedAt: string
  logs?: JobLog[]
}

export interface TopicJob extends BaseJob {
  type: typeof JOB_TYPE.GENERATE_TOPIC
  topicJob: TopicJobDetail
  blogJob: null
}

export interface BlogPostJob extends BaseJob {
  type: typeof JOB_TYPE.POST
  blogJob: BlogJobDetail
  topicJob: null
}

export type Job = TopicJob | BlogPostJob

export interface JobLog {
  id: string
  jobId: string
  message: string
  level: string
  createdAt: string
}

export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
}
