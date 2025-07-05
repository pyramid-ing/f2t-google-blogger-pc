import { Job as PrismaJob } from '@prisma/client'

export type JobResult = {
  resultUrl?: string
  resultMsg?: string
}

export interface JobProcessor {
  process(jobId: string): Promise<JobResult | void>
  canProcess(job: PrismaJob): boolean
}
