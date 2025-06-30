import { Injectable, Logger } from '@nestjs/common'
import { chromium } from 'playwright'
import { SettingsService } from '../settings/settings.service'

export interface ThumbnailOptions {
  title: string
  subtitle?: string
  backgroundColor?: string
  textColor?: string
  fontSize?: number
  width?: number
  height?: number
  fontFamily?: string
}

@Injectable()
export class ThumbnailGeneratorService {
  private readonly logger = new Logger(ThumbnailGeneratorService.name)

  constructor(private readonly settingsService: SettingsService) {}

  async generateThumbnail(options: ThumbnailOptions): Promise<Buffer> {
    const {
      title,
      subtitle = '',
      backgroundColor = '#4285f4',
      textColor = '#ffffff',
      fontSize = 48,
      width = 1024,
      height = 1024,
      fontFamily = 'Arial, sans-serif',
    } = options

    const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    try {
      const page = await browser.newPage()
      await page.setViewportSize({ width, height })

      const html = this.generateThumbnailHTML({
        title,
        subtitle,
        backgroundColor,
        textColor,
        fontSize,
        fontFamily,
        width,
        height,
      })

      await page.setContent(html)

      const screenshot = await page.screenshot({
        type: 'png',
        clip: {
          x: 0,
          y: 0,
          width,
          height,
        },
      })

      return screenshot
    } catch (error) {
      this.logger.error('썸네일 생성 중 오류 발생:', error)
      throw new Error(`썸네일 생성 실패: ${error.message}`)
    } finally {
      await browser.close()
    }
  }

  private generateThumbnailHTML(options: ThumbnailOptions & { width: number; height: number }): string {
    const { title, subtitle, backgroundColor, textColor, fontSize, fontFamily, width, height } = options

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            width: ${width}px;
            height: ${height}px;
            background: ${backgroundColor};
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            font-family: ${fontFamily};
            overflow: hidden;
        }
        
        .container {
            text-align: center;
            padding: 60px;
            max-width: 90%;
        }
        
        .title {
            color: ${textColor};
            font-size: ${fontSize}px;
            font-weight: bold;
            line-height: 1.2;
            margin-bottom: ${subtitle ? '20px' : '0'};
            word-wrap: break-word;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        .subtitle {
            color: ${textColor};
            font-size: ${fontSize * 0.6}px;
            font-weight: 400;
            line-height: 1.4;
            opacity: 0.9;
            word-wrap: break-word;
        }
        
        .gradient-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, ${backgroundColor}CC, ${backgroundColor}FF);
            z-index: -1;
        }
    </style>
</head>
<body>
    <div class="gradient-overlay"></div>
    <div class="container">
        <div class="title">${title}</div>
    </div>
</body>
</html>
    `
  }

  private escapeHtml(text: string): string {
    const div = { innerHTML: '' } as any
    div.textContent = text
    return div.innerHTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }
}
