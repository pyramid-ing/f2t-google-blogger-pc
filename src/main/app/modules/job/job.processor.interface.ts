import { Job } from '@prisma/client'

export interface JobProcessor {
  process(jobId: string): Promise<void>
  canProcess(job: Job): boolean
}
