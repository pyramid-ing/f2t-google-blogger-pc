import { IsUrl, IsNotEmpty } from 'class-validator'

export class CreateCrawlJobDto {
  @IsUrl({}, { message: '유효한 URL을 입력해주세요.' })
  @IsNotEmpty({ message: 'URL은 필수 항목입니다.' })
  url: string
}

export interface CrawlJobResult {
  success: boolean
  title?: string
  error?: string
  url: string
}
