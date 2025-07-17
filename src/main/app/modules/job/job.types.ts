import { Job } from '@prisma/client'

export enum JobType {
  BLOG_POST = 'post',
  GENERATE_TOPIC = 'generate_topic',
}

export enum JobStatus {
  PENDING = 'pending',
  REQUEST = 'request',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum BlogJobStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  FAILED = 'failed',
}

export type JobResult = {
  resultUrl?: string
  resultMsg?: string
}

export interface JobProcessor {
  process(jobId: string): Promise<JobResult | void>
  canProcess(job: Job): boolean
}
