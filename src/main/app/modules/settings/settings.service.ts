import { Injectable, Logger } from '@nestjs/common'
import { OpenAI } from 'openai'
import { createPerplexity } from '@ai-sdk/perplexity'
import { generateText } from 'ai'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { AppSettings } from '@render/types/settings'

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name)

  constructor(private readonly prisma: PrismaService) {}

  // 앱 설정 조회
  async getAppSettings(): Promise<AppSettings> {
    const settings = await this.findByKey('app')
    return settings?.data as unknown as AppSettings
  }

  // 앱 설정 업데이트
  async updateAppSettings(appSettings: AppSettings) {
    await this.saveByKey('app', appSettings)
  }

  // 모든 설정 조회
  async findAll() {
    return this.prisma.settings.findMany()
  }

  // key로 조회
  async findByKey(key: string) {
    return this.prisma.settings.findFirst({ where: { id: this.keyToId(key) } })
  }

  // key로 저장 (upsert)
  async saveByKey(key: string, data: any) {
    return this.prisma.settings.upsert({
      where: { id: this.keyToId(key) },
      update: { data },
      create: { id: this.keyToId(key), data },
    })
  }

  // upsert 메서드 (컨트롤러에서 사용)
  async upsert(key: string, data: any) {
    return this.saveByKey(key, data)
  }

  // OpenAI API 키 검증
  async validateOpenAIKey(apiKey: string): Promise<{ valid: boolean; error?: string; model?: string }> {
    try {
      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        return { valid: false, error: 'API 키가 비어있습니다.' }
      }

      const openai = new OpenAI({ apiKey: apiKey.trim() })

      // 간단한 모델 목록 조회로 API 키 유효성 검증
      const models = await openai.models.list()

      // GPT 모델이 있는지 확인
      const gptModels = models.data.filter(model => model.id.includes('gpt') || model.id.includes('o1'))

      if (gptModels.length === 0) {
        return { valid: false, error: 'GPT 모델에 접근할 수 없습니다.' }
      }

      // 사용 가능한 첫 번째 GPT 모델 반환
      const availableModel =
        gptModels.find(m => m.id.includes('gpt-4') || m.id.includes('gpt-3.5') || m.id.includes('o1'))?.id ||
        gptModels[0].id

      return {
        valid: true,
        model: availableModel,
      }
    } catch (error) {
      this.logger.error('OpenAI API 키 검증 실패:', error)

      if (error.status === 401) {
        return { valid: false, error: '유효하지 않은 API 키입니다.' }
      } else if (error.status === 429) {
        return { valid: false, error: 'API 사용량 한도를 초과했습니다.' }
      } else if (error.status === 403) {
        return { valid: false, error: 'API 키에 필요한 권한이 없습니다.' }
      } else {
        return { valid: false, error: `API 키 검증 실패: ${error.message}` }
      }
    }
  }

  // Perplexity API 키 검증
  async validatePerplexityKey(apiKey: string): Promise<{ valid: boolean; error?: string; model?: string }> {
    try {
      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        return { valid: false, error: 'API 키가 비어있습니다.' }
      }

      const perplexity = createPerplexity({
        apiKey: apiKey.trim(),
      })

      const model = perplexity('sonar')

      // 간단한 텍스트 생성으로 API 키 유효성 검증
      const result = await generateText({
        model,
        prompt: 'Hello',
        maxTokens: 10,
        temperature: 0.1,
      })

      if (result.text && result.text.length > 0) {
        return {
          valid: true,
          model: 'sonar',
        }
      } else {
        return { valid: false, error: 'API 응답이 올바르지 않습니다.' }
      }
    } catch (error) {
      this.logger.error('Perplexity API 키 검증 실패:', error)

      // AI SDK 오류 처리
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        return { valid: false, error: '유효하지 않은 API 키입니다.' }
      } else if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        return { valid: false, error: 'API 사용량 한도를 초과했습니다.' }
      } else if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
        return { valid: false, error: 'API 키에 필요한 권한이 없습니다.' }
      } else if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
        return { valid: false, error: 'API 요청 시간이 초과되었습니다.' }
      } else {
        return { valid: false, error: `API 키 검증 실패: ${error.message}` }
      }
    }
  }

  // key를 id로 변환 (간단 매핑, 실제 운영시 key 컬럼 추가 권장)
  private keyToId(key: string): number {
    if (key === 'app') return 1
    return 9999 // 기타
  }
}
