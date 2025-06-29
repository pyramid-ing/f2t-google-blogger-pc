import {
  Controller,
  Get,
  Post,
  Logger,
  Query,
  Res,
  ParseIntPipe,
  DefaultValuePipe,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import { TopicService } from '../topic/topic.service'
import * as XLSX from 'xlsx'
import { GoogleBloggerService } from '@main/app/modules/google/blogger/google-blogger.service'
import { ImagePixabayService } from 'src/main/app/modules/media/image-pixabay.service'
import { SettingsService } from '../settings/settings.service'
import { BlogPostHtml, OpenAiService } from '../ai/openai.service'
import { PerplexityService, LinkResult } from '../ai/perplexity.service'

@Controller('workflow')
export class WorkflowController {
  private readonly logger = new Logger(WorkflowController.name)

  constructor(
    private readonly topicService: TopicService,
    private readonly bloggerService: GoogleBloggerService,
    private readonly imageAgent: ImagePixabayService,
    private readonly settingsService: SettingsService,
    private readonly openAiService: OpenAiService,
    private readonly perplexityService: PerplexityService,
  ) {}

  /**
   * SEO 최적화된 주제 찾기 및 엑셀 다운로드
   * GET /workflow/find-topics?topic=소상공인&limit=10
   */
  @Get('find-topics')
  async findTopics(
    @Query('topic') topic: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Res() res: Response,
  ): Promise<void> {
    this.logger.log(`주제 찾기 요청: topic=${topic}, limit=${limit}`)

    if (!topic) {
      throw new Error('주제(topic) 파라미터는 필수입니다.')
    }

    try {
      // 1. OpenAI를 통해 SEO 제목 생성
      const topics = await this.topicService.generateTopics(topic, limit)

      // 2. 엑셀 데이터 준비
      const excelData = [
        ['SEO 제목', '내용'], // 헤더
        ...topics.map(item => [item.title, item.content]),
      ]

      // 3. 워크북 및 워크시트 생성
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.aoa_to_sheet(excelData)

      // 4. 컬럼 너비 설정
      worksheet['!cols'] = [
        { width: 40 }, // SEO 제목
        { width: 50 }, // 내용
      ]

      // 5. 워크시트를 워크북에 추가
      XLSX.utils.book_append_sheet(workbook, worksheet, 'SEO 제목 목록')

      // 6. 엑셀 파일 생성
      const fileName = `seo-titles-${new Date().toISOString().split('T')[0]}.xlsx`
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

      // 7. 응답 헤더 설정 및 파일 전송
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.send(buffer)

      this.logger.log(`엑셀 파일 "${fileName}" 내보내기 완료`)
    } catch (error) {
      this.logger.error('워크플로우 실행 중 오류 발생:', error)
      throw error
    }
  }

  /**
   * 워크플로우 등록
   * POST /workflow/post
   */
  @Post('post')
  @UseInterceptors(FileInterceptor('file'))
  async registerWorkflow(@UploadedFile() file: any, @Res() res: Response): Promise<void> {
    this.logger.log('워크플로우 등록 요청')

    if (!file) {
      throw new Error('엑셀 파일은 필수입니다.')
    }

    try {
      // 1. 엑셀 파일 파싱
      const workbook = XLSX.read(file.buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

      // 2. 각 행별로 처리
      for (const row of data.slice(1)) {
        // // 첫 번째 행은 헤더
        const [title, description] = row
        this.logger.log(`포스팅 처리: 제목=${title}, 설명=${description}`)

        // // 3. 포스팅 목차 생성
        // const blogOutline = await this.topicService.generateBlogOutline(title, description)
        // this.logger.log(`생성된 목차: ${JSON.stringify(blogOutline.sections)}`)
        //
        // // 4. 포스팅 내용 구체적으로 만들기
        // const detailedContent = await this.topicService.generatePostingContentsWithOpenAI(blogOutline)

        const detailedContent: BlogPostHtml = {
          sections: [
            {
              html: '<p>사과는 건강에 좋은 과일로 잘 알려져 있으며, 다양한 효능이 있습니다. 본 글에서는 사과의 주요 건강 효능과 이점에 대해 자세히 알아보겠습니다. 사과를 통해 여러분의 건강을 지키는 작은 습관을 만들어보세요.</p>',
              imageUrl:
                'https://pixabay.com/get/g8bee389ca5979ecc419e91097295557dd1e8a8e13b9c4561e3e0566cb62150b9af7a8ea35f96cc55e38e84b5f6c7871b772fe6eb41445a31d53dc314a1f0ce6f_1280.jpg',
            },
            {
              html: '<h2>사과의 주요 영양 성분</h2><p>사과는 비타민 C, 식이섬유, 항산화 물질이 풍부한 과일로, 적은 칼로리로 건강한 간식으로 적합합니다. 또한, 칼륨, 비타민 K, 비타민 B6, 마그네슘 등 다양한 미네랄이 포함되어 있어 균형 잡힌 영양을 제공합니다.</p><ul><li><strong>비타민 C</strong>: 면역력 강화와 피부 건강에 도움을 줍니다.</li><li><strong>식이섬유</strong>: 소화기능 개선과 포만감 제공에 효과적입니다.</li><li><strong>항산화 물질</strong>: 세포 손상을 예방하고, 노화를 방지합니다.</li></ul><blockquote><p>"사과 한 알을 매일 먹으면 의사를 멀리할 수 있다"는 말처럼, 사과는 우리 건강에 정말 큰 도움이 됩니다.</p></blockquote>',
              imageUrl:
                'https://pixabay.com/get/g8cfec40d4089a13946869e20aac3560583a0f288c2227f578c2c8ecabf06b90bea4b2be8d5c9e2773d225e1be7a866c0_1280.jpg',
            },
            {
              html: '<h2>소화 건강 증진</h2><p>사과에 포함된 식이섬유는 장 건강에 큰 도움을 줍니다. 특히 변비 예방에 효과적이며, 정기적으로 사과를 섭취하면 소화기능을 개선할 수 있습니다. 식이섬유는 배변 활동을 촉진하고, 장내 유익균의 성장을 도와 장 건강을 지킵니다.</p><ul><li><strong>변비 예방</strong>: 규칙적인 식이섬유 섭취는 장 운동을 활성화시킵니다.</li><li><strong>장내 유익균 증식</strong>: 좋은 박테리아의 성장을 촉진하여 장 환경을 개선합니다.</li></ul><blockquote><p>어린 시절 어머니께서 변비가 생길 때마다 사과를 먹으라던 기억이 납니다. 간단하지만 확실한 방법이었죠.</p></blockquote>',
              imageUrl:
                'https://pixabay.com/get/ge224fdaeee33883fee331f555e8565046d3f89a02c666f2085812d47375bd549e08865576a50267d62bc292cce61acaf11e0891e10ae195d0fb4a0f8879ae6b5_1280.jpg',
            },
            {
              html: '<h2>심장 건강에 도움</h2><p>사과는 심장에 좋은 펙틴과 플라바노이드가 포함되어 있습니다. 이 성분들은 콜레스테롤 수치를 낮추고 심혈관 질환 예방에 도움을 줍니다. 펙틴은 수용성 섬유질로, 체내에서 콜레스테롤을 흡착하여 배출을 촉진합니다.</p><ul><li><strong>콜레스테롤 수치 감소</strong>: 펙틴이 콜레스테롤 흡수를 차단합니다.</li><li><strong>심혈관 질환 예방</strong>: 플라바노이드의 항산화 효과가 혈관 건강을 유지합니다.</li></ul><blockquote><p>사과를 꾸준히 드시던 할머니께서는 나이가 드셔도 심장 건강을 잘 유지하셨습니다. 이처럼 사과는 심장을 지켜주는 작은 보약과 같습니다.</p></blockquote>',
              imageUrl:
                'https://pixabay.com/get/gbf5e275fb2af82241db6183fd438514cb33ee31efbe587de3f85422b62a39c03d3effe5910d030b8a8d78bade8a4b0b25ee4e8a1eb964974f3ab01c7c0bab3f9_1280.jpg',
            },
            {
              html: '<h2>체중 관리</h2><p>사과는 칼로리가 낮고 포만감을 주기 때문에 다이어트 시 간식으로 적합합니다. 규칙적인 사과 섭취는 체중 관리에 긍정적인 영향을 미칠 수 있으며, 식사 전 사과를 섭취하면 식사량을 자연스럽게 줄일 수 있습니다.</p><ul><li><strong>포만감 제공</strong>: 식이섬유가 포만감을 오래 지속시킵니다.</li><li><strong>칼로리 부담 감소</strong>: 사과의 낮은 칼로리는 체중 증가를 억제합니다.</li></ul><blockquote><p>저 역시 다이어트를 할 때 사과를 간식으로 자주 먹었는데, 식욕을 억제하는데 큰 도움이 되었습니다.</p></blockquote>',
              imageUrl:
                'https://pixabay.com/get/g5ace1ee8cd058c1784f8eafb49fe4afa1bbe14760d7e0898fd3f6415f52e370a1edfe9ebd198b857576c2f69ded68dd8e118cef5fa50787b1d8b3e2dfacc54dc_1280.jpg',
            },
            {
              html: '<h2>항산화 효과</h2><p>사과에는 여러 가지 항산화 물질이 포함되어 있어 세포 손상을 예방하고, 노화 방지 효과가 있습니다. 이는 면역력 향상에도 기여합니다. 항산화 물질은 우리 몸의 유해한 활성산소를 제거하는 데 중요한 역할을 합니다.</p><ul><li><strong>세포 손상 예방</strong>: 항산화 물질이 세포를 보호합니다.</li><li><strong>노화 방지</strong>: 피부 탄력을 유지하고 주름 생성을 억제합니다.</li></ul><blockquote><p>"사과를 매일 먹으면 젊음을 유지할 수 있다"는 말이 있을 정도로, 사과의 항산화 효과는 뛰어납니다.</p></blockquote>',
              imageUrl:
                'https://pixabay.com/get/ge6ea18633c619073622f319d4c57df80eadca2218efeacf9194cacd2359fd1fc7a16aae1d080995f9eb7553b1d6bf736d44be981abb6a4bd37d7b9f166dbaeb7_1280.jpg',
            },
            {
              html: '<h2>혈당 조절</h2><p>사과는 당 지수가 낮아 혈당을 안정시키는데 도움을 줄 수 있습니다. 특히 당뇨 환자에게 안전한 간식으로 추천됩니다. 사과에 포함된 식이섬유는 당의 흡수를 천천히 하여 혈당 스파이크를 방지합니다.</p><ul><li><strong>혈당 안정</strong>: 낮은 당 지수로 혈당 변동을 최소화합니다.</li><li><strong>안전한 간식</strong>: 당뇨 환자에게도 적합한 선택입니다.</li></ul><blockquote><p>당뇨를 관리하는 친구가 사과를 즐겨 먹는데, 혈당 조절에 큰 도움이 된다고 하더라고요.</p></blockquote>',
              imageUrl:
                'https://pixabay.com/get/gc310dc2174353f8fccafe156f4f60ad4696b1802084dba4684087b20ce92999dd3580e920de9071202a4ab4baf51e2424a23cc828394755a7769920d2d751c87_1280.jpg',
            },
            {
              html: '<h2>FAQ (자주 묻는 질문)</h2><div class="chat-screen"><!-- 질문 (내 메시지) --><div class="chat-line chat-right"><div><h3 class="chat-bubble chat-bubble-right">사과를 하루에 얼마나 먹어야 하나요?</h3></div></div><!-- 답변 (상대 메시지) --><div class="chat-line chat-left"><div><p class="chat-bubble chat-bubble-left">하루 1~2개가 적당합니다.</p></div></div><!-- 질문 --><div class="chat-line chat-right"><div><h3 class="chat-bubble chat-bubble-right">사과의 껍질도 먹어야 하나요?</h3></div></div><!-- 답변 --><div class="chat-line chat-left"><div><p class="chat-bubble chat-bubble-left">껍질에 영양소가 많아 함께 먹는 것이 좋습니다.</p></div></div><!-- 질문 --><div class="chat-line chat-right"><div><h3 class="chat-bubble chat-bubble-right">사과를 섭취할 때 주의할 점은 무엇인가요?</h3></div></div><!-- 답변 --><div class="chat-line chat-left"><div><p class="chat-bubble chat-bubble-left">알레르기가 있을 경우 주의해야 합니다.</p></div></div></div>',
              imageUrl:
                'https://pixabay.com/get/g91f9b22eeb603c6af9d8750d521a0d6229cdd1ff7c766bc93c5b82b06c27592322f0eee3d7cb6936b1262e61ce7867e2_1280.jpg',
            },
            {
              html: '<h2>사과 활용 방법</h2><p>사과는 생으로 먹는 것 외에도 샐러드, 주스, 디저트 등 다양한 요리에 활용할 수 있습니다. 건강한 스낵으로 손쉽게 활용해 보세요. 아침에는 사과와 오트밀로 건강한 시작을 할 수 있습니다.</p><ul><li><strong>샐러드</strong>: 신선한 사과를 샐러드에 첨가하여 상큼함을 더해보세요.</li><li><strong>주스</strong>: 사과주스는 비타민 C를 쉽게 섭취할 수 있는 방법입니다.</li><li><strong>디저트</strong>: 사과 파이, 크럼블 등 다양한 디저트로도 활용 가능합니다.</li></ul><blockquote><p>친구들과의 피크닉에서 사과를 이용한 샐러드를 만들어 갔더니, 상큼하고 맛있다고 다들 좋아했어요.</p></blockquote>',
              imageUrl:
                'https://pixabay.com/get/g41b323b428a7458cbf3218c3e2398c20229068ae4531e16dbe0bade282b91d28060109382f7ac612f392199ee96a6eb651f87f53aa4f803e1bb268af0427365f_1280.jpg',
            },
            {
              html: '<h2>마무리 및 팁</h2><p>사과는 건강에 다양한 이점을 제공하는 과일입니다. 매일 사과를 섭취하여 건강한 습관을 기르는 것을 추천합니다. 사과는 언제 어디서든 쉽게 구할 수 있으며, 간편하게 섭취할 수 있는 최고의 자연 간식입니다. 지금 당장 사과를 준비해보세요!</p>',
              imageUrl:
                'https://pixabay.com/get/g96886f42719274b8e6286ff50c98e2613e57c41c3fbb72381b70d0898d01f06136a59a5a7515075636408f7e14b967632a9f98286ea5c3f281f3f7c2e1350bec_1280.jpg',
            },
          ],
        }

        // 5. sections 배열 루프하면서 이미지, 링크 및 광고 처리
        for (let i = 0; i < detailedContent.sections.length; i++) {
          const section = detailedContent.sections[i]
          let imageUrl: string | undefined
          let links: LinkResult[] = []
          let sectionHtml = section.html

          // 이미지 생성 처리
          imageUrl = await this.generateImageBySettings(section.html, i + 1)

          try {
            // Perplexity를 통한 관련 링크 생성
            links = await this.perplexityService.generateRelevantLinks(section.html)
            this.logger.log(`섹션 ${i + 1}에 대한 관련 링크: ${JSON.stringify(links)}`)
          } catch (error) {
            this.logger.warn(`섹션 ${i + 1} 링크 처리 중 오류: ${error.message}`)
          }

          // 광고 스크립트 추가
          try {
            const adScript = await this.insertAdScript(section.html, i + 1)
            if (adScript) {
              sectionHtml = adScript
            }
          } catch (error) {
            this.logger.warn(`섹션 ${i + 1} 광고 삽입 중 오류: ${error.message}`)
          }

          // 섹션에 이미지 URL, 링크, 광고가 추가된 HTML 및 AI 이미지 프롬프트 적용
          detailedContent.sections[i] = {
            html: sectionHtml,
            imageUrl,
            links,
          }
        }

        // 6. HTML로 합치기
        const combinedHtml = this.topicService.combineHtmlSections(detailedContent)
        console.log(combinedHtml)

        // 7. Blogger API로 포스팅하기
        const bloggerResponse = await this.bloggerService.postToBlogger({
          title,
          content: combinedHtml,
        })

        // 등록 결과 정보 출력
        this.logger.log(`✅ Blogger에 포스팅 완료!`)
        this.logger.log(`📝 제목: ${bloggerResponse.title}`)
        this.logger.log(`🔗 URL: ${bloggerResponse.url}`)
        this.logger.log(`📅 발행일: ${bloggerResponse.published}`)
        this.logger.log(`🆔 포스트 ID: ${bloggerResponse.id}`)
      }

      res.status(201).json({
        success: true,
        message: '워크플로우 등록 완료',
        processedCount: data.slice(1).length,
        timestamp: new Date().toISOString(),
      })
      this.logger.log(`🎉 전체 워크플로우 등록 완료 - 총 ${data.slice(1).length}개 포스트 처리됨`)
    } catch (error) {
      this.logger.error('워크플로우 등록 중 오류 발생:', error)
      throw error
    }
  }

  /**
   * SEO 최적화된 콘텐츠 생성
   * @param {string} mainTitle - 콘텐츠의 메인 제목
   * @param {string[]} topics - 각 섹션의 주제 목록
   */
  generateSEOContent(mainTitle: string, topics: string[]) {
    // 변수 설정
    const style = '친근한'
    const format = '마크다운'
    const length = 1200 // 총 목표 분량
    const targetAudience = '일반 대중'
    const purpose = 'SEO 최적화된 블로그 포스트 작성'

    // 섹션 배열 생성
    const sections = topics.map((topic, index) => ({
      title: `Section ${index + 1}: ${topic}`,
      summary: `${topic}에 대한 내용을 다룹니다.`,
      targetLength: 300,
      content: [
        { heading: 'h2', text: topic },
        { heading: 'p', text: `${topic}에 대한 상세 설명입니다.` },
      ],
    }))

    // 각 섹션에 대해 작업 수행
    sections.forEach(section => {
      // 단어 수 추적 및 확장
      let currentLength = 0
      section.content.forEach(item => {
        currentLength += item.text.split(' ').length
      })

      while (currentLength < section.targetLength) {
        // 관련 내용 확장
        const additionalContent = this.generateContent(section.title, style, format)
        section.content.push({ heading: 'p', text: additionalContent })
        currentLength += additionalContent.split(' ').length
      }
    })

    // SEO 전략 적용
    this.applySEO(sections)

    // 결과 출력
    console.log(sections)
  }

  // Dummy functions for content generation and SEO application
  generateContent(title: string, style: string, format: string): string {
    return `Generated content for ${title} in ${style} style and ${format} format.`
  }

  applySEO(sections: any[]): void {
    console.log('SEO strategies applied.')
  }

  /**
   * 설정에 따라 이미지를 생성하는 함수
   * @param html - 섹션의 HTML 내용
   * @param sectionIndex - 섹션 번호
   * @returns 이미지 URL 또는 undefined
   */
  async generateImageBySettings(html: string, sectionIndex: number): Promise<string | undefined> {
    try {
      // 현재 이미지 설정 가져오기
      const settings = await this.settingsService.getAppSettings()
      const imageType = settings.imageType || 'none'

      switch (imageType) {
        case 'pixabay':
          try {
            // Pixabay 이미지 검색용 프롬프트 생성
            const pixabayKeyword = await this.openAiService.generatePixabayPrompt(html)
            this.logger.log(`섹션 ${sectionIndex}에 대한 키워드: ${pixabayKeyword}`)

            // 이미지 검색 및 링크 적용
            const imageUrl = await this.imageAgent.searchImage(pixabayKeyword)
            this.logger.log(`섹션 ${sectionIndex}에 대한 이미지 URL: ${imageUrl}`)
            return imageUrl
          } catch (error) {
            this.logger.warn(`섹션 ${sectionIndex} Pixabay 이미지 처리 중 오류: ${error.message}`)
            return undefined
          }

        case 'ai':
          try {
            // HTML 콘텐츠를 분석해서 AI 이미지 프롬프트 생성
            const aiImagePrompt = await this.openAiService.generateAiImagePrompt(html)
            this.logger.log(`섹션 ${sectionIndex}에 대한 AI 이미지 프롬프트: ${aiImagePrompt}`)

            // OpenAI DALL-E로 이미지 생성
            const imageUrl = await this.openAiService.generateImage(aiImagePrompt)
            this.logger.log(`섹션 ${sectionIndex}에 대한 AI 생성 이미지 URL: ${imageUrl}`)
            return imageUrl
          } catch (error) {
            this.logger.warn(`섹션 ${sectionIndex} AI 이미지 생성 중 오류: ${error.message}`)
            return undefined
          }

        case 'none':
        default:
          // 이미지를 사용하지 않음
          this.logger.log(`섹션 ${sectionIndex}: 이미지 사용 안함 설정`)
          return undefined
      }
    } catch (error) {
      this.logger.warn(`섹션 ${sectionIndex} 이미지 처리 중 오류: ${error.message}`)
      return undefined
    }
  }

  /**
   * 설정에 따라 광고 스크립트를 삽입하는 함수
   * @param html - 섹션의 HTML 내용
   * @param sectionIndex - 섹션 번호
   * @returns 광고가 삽입된 HTML 또는 undefined
   */
  async insertAdScript(html: string, sectionIndex: number): Promise<string | undefined> {
    try {
      // 현재 광고 설정 가져오기
      const settings = await this.settingsService.getAppSettings()
      const adEnabled = settings.adEnabled || false
      const adScript = settings.adScript

      // 광고가 비활성화되어 있거나 광고 스크립트가 없으면 원본 HTML 반환
      if (!adEnabled || !adScript || adScript.trim() === '') {
        this.logger.log(`섹션 ${sectionIndex}: 광고 삽입 안함 (활성화: ${adEnabled}, 스크립트 존재: ${!!adScript})`)
        return html
      }

      // 광고 스크립트를 섹션 끝에 추가
      const htmlWithAd = `${html}\n\n<div class="ad-section" style="margin: 20px 0; text-align: center;">\n${adScript}\n</div>`

      this.logger.log(`섹션 ${sectionIndex}: 광고 스크립트 삽입 완료`)
      return htmlWithAd
    } catch (error) {
      this.logger.warn(`섹션 ${sectionIndex} 광고 삽입 중 오류: ${error.message}`)
      return html
    }
  }
}
