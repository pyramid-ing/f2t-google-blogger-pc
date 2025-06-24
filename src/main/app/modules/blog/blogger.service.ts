import { Injectable, Logger } from '@nestjs/common'
import { google } from 'googleapis'

interface BlogPost {
  title: string
  content: string
  labels: string[]
  meta: {
    title: string
    description: string
  }
  jsonLd: Record<string, any>
}

@Injectable()
export class BloggerService {
  private readonly logger = new Logger(BloggerService.name)
  private readonly blogger
  private readonly blogId = process.env.BLOGGER_BLOG_ID

  constructor() {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/blogger'],
    })

    this.blogger = google.blogger({
      version: 'v3',
      auth,
    })
  }

  async createPost(post: BlogPost): Promise<string> {
    this.logger.log(`블로그 포스트 생성: ${post.title}`)

    try {
      // 1. 메타 태그 생성
      const metaTags = `
<meta name="title" content="${post.meta.title}" />
<meta name="description" content="${post.meta.description}" />
`

      // 2. JSON-LD 스크립트 생성
      const jsonLdScript = `
<script type="application/ld+json">
${JSON.stringify(post.jsonLd, null, 2)}
</script>
`

      // 3. 최종 HTML 생성
      const htmlContent = `
${metaTags}
${jsonLdScript}
${post.content}
`

      // 4. Blogger API로 포스트 생성
      const response = await this.blogger.posts.insert({
        blogId: this.blogId,
        requestBody: {
          title: post.title,
          content: htmlContent,
          labels: post.labels,
        },
      })

      this.logger.log(`포스트가 성공적으로 생성되었습니다: ${response.data.url}`)
      return response.data.url
    } catch (error) {
      this.logger.error('블로그 포스트 생성 실패:', error)
      throw error
    }
  }
}
