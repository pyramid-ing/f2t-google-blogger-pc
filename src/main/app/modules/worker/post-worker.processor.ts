import { Process, Processor } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import { Job } from 'bull'
import { AIService } from '../ai/ai.service'
import { YoutubeAgent } from '../ai/youtube.agent'
import { ImageAgent } from '../media/image.agent'
import { ImageUploadService } from '../media/image-upload.service'
import { BloggerService } from '../blog/blogger.service'
import { SeoService } from '../blog/seo.service'

interface GenerateJobData {
  title: string
  description: string
  keywords: string[]
}

@Processor('posts')
export class PostWorkerProcessor {
  private readonly logger = new Logger(PostWorkerProcessor.name)

  constructor(
    private readonly aiService: AIService,
    private readonly youtubeAgent: YoutubeAgent,
    private readonly imageAgent: ImageAgent,
    private readonly imageUploadService: ImageUploadService,
    private readonly bloggerService: BloggerService,
    private readonly seoService: SeoService,
  ) {}

  @Process('generate')
  async handleGenerate(job: Job<GenerateJobData>) {
    this.logger.log(`포스트 생성 작업 시작: ${job.data.title}`)

    try {
      // 1. GPT로 컨텐츠 생성
      const content = await this.aiService.generateContent(job.data.title, job.data.description)

      // 2. YouTube 영상 검색 및 삽입
      const youtubeUrl = await this.youtubeAgent.findRelevantVideo(job.data.title)
      const contentWithYoutube = this.insertYoutubeEmbed(content, youtubeUrl)

      // 3. 이미지 검색 및 업로드
      const imageKeyword = await this.imageAgent.extractKeyword(content)
      const imageUrl = await this.imageAgent.searchImage(imageKeyword)
      const uploadedImageUrl = await this.imageUploadService.upload(imageUrl)
      const contentWithImage = this.insertImage(contentWithYoutube, uploadedImageUrl)

      // 4. SEO 메타데이터 생성
      const seoData = await this.seoService.generateMetadata({
        title: job.data.title,
        content: contentWithImage,
        keywords: job.data.keywords,
      })

      // 5. Blogger에 포스팅
      await this.bloggerService.createPost({
        title: job.data.title,
        content: contentWithImage,
        labels: job.data.keywords,
        meta: seoData.meta,
        jsonLd: seoData.jsonLd,
      })

      this.logger.log(`포스트 생성 완료: ${job.data.title}`)
    } catch (error) {
      this.logger.error(`포스트 생성 실패: ${error.message}`, error.stack)
      throw error
    }
  }

  private insertYoutubeEmbed(content: string, youtubeUrl: string): string {
    const embedCode = `<div class="video-container">
      <iframe 
        width="560" 
        height="315" 
        src="${youtubeUrl.replace('watch?v=', 'embed/')}" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen>
      </iframe>
    </div>`

    return `${content}\n\n${embedCode}`
  }

  private insertImage(content: string, imageUrl: string): string {
    const imageCode = `<div class="image-container">
      <img src="${imageUrl}" alt="포스트 관련 이미지" />
    </div>`

    return `${imageCode}\n\n${content}`
  }
}
