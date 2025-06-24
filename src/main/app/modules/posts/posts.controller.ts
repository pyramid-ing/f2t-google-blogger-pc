import { Controller, Post, UseInterceptors, UploadedFile, Logger } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { PostsService } from './posts.service'
import { Express } from 'express'

@Controller('posts')
export class PostsController {
  private readonly logger = new Logger(PostsController.name)

  constructor(private readonly postsService: PostsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadExcel(@UploadedFile() file: Express.Multer.File) {
    this.logger.log('엑셀 파일 업로드 요청 수신')

    const posts = await this.postsService.parseExcel(file.buffer)
    await this.postsService.enqueuePosts(posts)

    return {
      message: '포스트가 성공적으로 큐에 등록되었습니다.',
      count: posts.length,
    }
  }
}
