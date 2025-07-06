import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator'

export class UpdateSettingsDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['openai', 'gemini'])
  aiProvider: 'openai' | 'gemini'

  @IsString()
  @IsOptional()
  openaiApiKey?: string

  @IsString()
  @IsOptional()
  geminiApiKey?: string
}

export class SettingsResponseDto {
  aiProvider: 'openai' | 'gemini'
  openaiApiKey?: string
  geminiApiKey?: string
}
