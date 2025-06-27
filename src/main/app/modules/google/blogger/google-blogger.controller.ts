import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { GoogleBloggerService } from 'src/main/app/modules/google/blogger/google-blogger.service'

@Controller('google-blogger')
export class GoogleBloggerController {
  constructor(private readonly bloggerService: GoogleBloggerService) {}

  /**
   * 블로그 게시물 목록 조회
   */
  @Post('posts')
  async getBlogPosts(@Body() options: any): Promise<any> {
    const posts = await this.bloggerService.getBlogPosts(options)
    return { posts }
  }

  /**
   * 특정 게시물 조회
   */
  @Get('blogs/:blogId/posts/:postId')
  async getBlogPost(@Param('blogId') blogId: string, @Param('postId') postId: string): Promise<any> {
    const post = await this.bloggerService.getBlogPost(blogId, postId)
    return { post }
  }

  /**
   * 블로그 정보 조회
   */
  @Get('blogs/:blogId')
  async getBlogInfo(@Param('blogId') blogId: string): Promise<any> {
    const blog = await this.bloggerService.getBlogInfo(blogId)
    return { blog }
  }

  /**
   * 블로그 URL로 블로그 정보 조회
   */
  @Post('blogs/by-url')
  async getBlogByUrl(@Body() body: { blogUrl: string }): Promise<any> {
    const { blogUrl } = body

    if (!blogUrl) {
      throw new Error('blogUrl이 필요합니다.')
    }

    const blog = await this.bloggerService.getBlogByUrl(blogUrl)
    return { blog }
  }

  /**
   * 사용자의 블로그 목록 조회
   */
  @Get('user/blogs')
  async getUserBlogs(): Promise<any> {
    const blogs = await this.bloggerService.getUserSelfBlogs()
    return { blogs }
  }
}
