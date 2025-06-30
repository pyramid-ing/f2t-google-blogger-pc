import { Injectable, Logger } from '@nestjs/common'
import { chromium } from 'playwright'
import { SettingsService } from '../settings/settings.service'
import * as path from 'path'
import * as fs from 'fs'

export interface ThumbnailOptions {
  title: string
  subtitle?: string
  backgroundColor?: string
  backgroundImagePath?: string
  textColor?: string
  fontSize?: number
  width?: number
  height?: number
  fontFamily?: string
}

interface ThumbnailLayoutElement {
  id: string
  type: 'title' | 'subtitle'
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontFamily: string
  color: string
  textAlign: 'left' | 'center' | 'right'
  fontWeight: 'normal' | 'bold'
  opacity: number
  rotation: number
  zIndex: number
}

interface ThumbnailLayoutData {
  id: string
  backgroundImage: string
  elements: ThumbnailLayoutElement[]
  createdAt: string
  updatedAt: string
}

@Injectable()
export class ThumbnailGeneratorService {
  private readonly logger = new Logger(ThumbnailGeneratorService.name)

  constructor(private readonly settingsService: SettingsService) {}

  async generateThumbnail(options: ThumbnailOptions): Promise<Buffer> {
    const {
      title,
      subtitle = '',
      backgroundImagePath,
      textColor = '#ffffff',
      fontSize = 48,
      fontFamily = 'BMDOHYEON',
    } = options

    // 사이즈를 1000x1000으로 고정
    const width = 1000
    const height = 1000

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
        backgroundImagePath,
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
    const { title, subtitle, backgroundImagePath, textColor, fontSize, fontFamily, width, height } = options

    // 배경 스타일 결정 - 배경색은 제거하고 배경이미지만 사용
    let backgroundStyle = 'background: #4285f4;' // 기본 배경색 (이미지가 없을 때만)

    if (backgroundImagePath && fs.existsSync(backgroundImagePath)) {
      // 배경이미지가 있는 경우
      const backgroundImageBase64 = this.convertImageToBase64(backgroundImagePath)
      backgroundStyle = `
        background-image: url('data:image/png;base64,${backgroundImageBase64}');
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
      `
    }

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    
    <!-- 한국 폰트 임포트 -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <style>
        @import url('http://fonts.googleapis.com/earlyaccess/nanumgothic.css');
        @import url('https://cdn.rawgit.com/moonspam/NanumSquare/master/nanumsquare.css');
        
        @font-face {
            font-family: 'BMDOHYEON';
            src: url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/BMDOHYEON.woff') format('woff');
            font-weight: normal;
            font-style: normal;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            width: ${width}px;
            height: ${height}px;
            ${backgroundStyle}
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            font-family: ${fontFamily}, 'Nanum Gothic', 'NanumSquare', sans-serif;
            overflow: hidden;
            position: relative;
        }
        
        .overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.4);
            z-index: 1;
        }
        
        .container {
            text-align: center;
            padding: 60px;
            max-width: 90%;
            position: relative;
            z-index: 2;
        }
        
        .title {
            color: ${textColor};
            font-size: ${fontSize}px;
            font-weight: bold;
            line-height: 1.2;
            margin-bottom: ${subtitle ? '20px' : '0'};
            word-wrap: break-word;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
        }
        
        .subtitle {
            color: ${textColor};
            font-size: ${fontSize * 0.6}px;
            font-weight: 400;
            line-height: 1.4;
            opacity: 0.9;
            word-wrap: break-word;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
        }
    </style>
</head>
<body>
    ${backgroundImagePath && fs.existsSync(backgroundImagePath) ? '<div class="overlay"></div>' : ''}
    <div class="container">
        <div class="title">${this.escapeHtml(title)}</div>
        ${subtitle ? `<div class="subtitle">${this.escapeHtml(subtitle)}</div>` : ''}
    </div>
</body>
</html>
    `
  }

  private convertImageToBase64(imagePath: string): string {
    try {
      const imageBuffer = fs.readFileSync(imagePath)
      return imageBuffer.toString('base64')
    } catch (error) {
      this.logger.error(`배경이미지 읽기 실패: ${imagePath}`, error)
      throw new Error(`배경이미지 읽기 실패: ${error.message}`)
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  /**
   * 배경이미지 저장 경로 반환
   * @param fileName 파일명
   * @returns 저장 경로
   */
  getBackgroundImagePath(fileName: string): string {
    const isDev = process.env.NODE_ENV !== 'production'

    if (isDev) {
      // 개발 환경: pwd/static/thumbnail/backgrounds/
      return path.join(process.cwd(), 'static', 'thumbnail', 'backgrounds', fileName)
    } else {
      // 프로덕션 환경: app.getPath('userData')/backgrounds/
      const { app } = require('electron')
      const userDataPath = app.getPath('userData')
      const backgroundsDir = path.join(userDataPath, 'backgrounds')

      // 디렉토리가 없으면 생성
      if (!fs.existsSync(backgroundsDir)) {
        fs.mkdirSync(backgroundsDir, { recursive: true })
      }

      return path.join(backgroundsDir, fileName)
    }
  }

  /**
   * 배경이미지 저장
   * @param imageBuffer 이미지 버퍼
   * @param fileName 파일명
   * @returns 저장된 파일 경로
   */
  async saveBackgroundImage(imageBuffer: Buffer, fileName: string): Promise<string> {
    const savePath = this.getBackgroundImagePath(fileName)

    try {
      // 디렉토리 생성 (존재하지 않는 경우)
      const dir = path.dirname(savePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      fs.writeFileSync(savePath, imageBuffer)
      this.logger.log(`배경이미지 저장 완료: ${savePath}`)
      return savePath
    } catch (error) {
      this.logger.error(`배경이미지 저장 실패: ${savePath}`, error)
      throw new Error(`배경이미지 저장 실패: ${error.message}`)
    }
  }

  /**
   * 저장된 배경이미지 목록 반환
   * @returns 배경이미지 파일명 배열
   */
  getBackgroundImages(): string[] {
    const isDev = process.env.NODE_ENV !== 'production'
    let backgroundsDir: string

    if (isDev) {
      backgroundsDir = path.join(process.cwd(), 'static', 'thumbnail', 'backgrounds')
    } else {
      const { app } = require('electron')
      const userDataPath = app.getPath('userData')
      backgroundsDir = path.join(userDataPath, 'backgrounds')
    }

    try {
      if (!fs.existsSync(backgroundsDir)) {
        return []
      }

      return fs
        .readdirSync(backgroundsDir)
        .filter(file => /\.(png|jpg|jpeg)$/i.test(file))
        .sort()
    } catch (error) {
      this.logger.error('배경이미지 목록 조회 실패:', error)
      return []
    }
  }

  /**
   * 배경이미지 삭제
   * @param fileName 삭제할 파일명
   */
  deleteBackgroundImage(fileName: string): boolean {
    const filePath = this.getBackgroundImagePath(fileName)

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        this.logger.log(`배경이미지 삭제 완료: ${filePath}`)
        return true
      }
      return false
    } catch (error) {
      this.logger.error(`배경이미지 삭제 실패: ${filePath}`, error)
      return false
    }
  }

  // 레이아웃 기반 썸네일 생성
  async generateThumbnailWithLayout(backgroundImagePath: string, layout: ThumbnailLayoutData): Promise<Buffer> {
    // 사이즈를 1000x1000으로 고정
    const width = 1000
    const height = 1000

    const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    try {
      const page = await browser.newPage()
      await page.setViewportSize({ width, height })

      const html = this.generateLayoutHTML(backgroundImagePath, layout, width, height)

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
      this.logger.error('레이아웃 썸네일 생성 중 오류 발생:', error)
      throw new Error(`레이아웃 썸네일 생성 실패: ${error.message}`)
    } finally {
      await browser.close()
    }
  }

  private generateLayoutHTML(
    backgroundImagePath: string,
    layout: ThumbnailLayoutData,
    width: number,
    height: number,
  ): string {
    // 배경 스타일 설정
    let backgroundStyle = 'background: #4285f4;' // 기본 배경색

    if (backgroundImagePath && fs.existsSync(backgroundImagePath)) {
      const backgroundImageBase64 = this.convertImageToBase64(backgroundImagePath)
      backgroundStyle = `
        background-image: url('data:image/png;base64,${backgroundImageBase64}');
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
      `
    }

    // 요소들을 z-index 순으로 정렬
    const sortedElements = [...layout.elements].sort((a, b) => a.zIndex - b.zIndex)

    // 각 요소의 HTML 생성
    const elementsHTML = sortedElements
      .map(element => {
        const justifyContent =
          element.textAlign === 'left' ? 'flex-start' : element.textAlign === 'right' ? 'flex-end' : 'center'

        return `
          <div class="text-element" style="
            position: absolute;
            left: ${element.x}%;
            top: ${element.y}%;
            width: ${element.width}%;
            height: ${element.height}%;
            display: flex;
            align-items: center;
            justify-content: ${justifyContent};
            z-index: ${element.zIndex};
            transform: rotate(${element.rotation}deg);
          ">
            <div style="
              color: ${element.color};
              font-size: ${element.fontSize}px;
              font-family: ${element.fontFamily}, 'Nanum Gothic', 'NanumSquare', sans-serif;
              font-weight: ${element.fontWeight};
              opacity: ${element.opacity};
              text-align: ${element.textAlign};
              word-wrap: break-word;
              text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
              line-height: 1.2;
              width: 100%;
            ">
              ${this.escapeHtml(element.text)}
            </div>
          </div>
        `
      })
      .join('')

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    
    <!-- 한국 폰트 임포트 -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <style>
        @import url('http://fonts.googleapis.com/earlyaccess/nanumgothic.css');
        @import url('https://cdn.rawgit.com/moonspam/NanumSquare/master/nanumsquare.css');
        
        @font-face {
            font-family: 'BMDOHYEON';
            src: url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/BMDOHYEON.woff') format('woff');
            font-weight: normal;
            font-style: normal;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            width: ${width}px;
            height: ${height}px;
            ${backgroundStyle}
            font-family: 'BMDOHYEON', 'Nanum Gothic', 'NanumSquare', sans-serif;
            overflow: hidden;
            position: relative;
        }
        
        .overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.2);
            z-index: 1;
        }
    </style>
</head>
<body>
    ${backgroundImagePath && fs.existsSync(backgroundImagePath) ? '<div class="overlay"></div>' : ''}
    ${elementsHTML}
</body>
</html>
    `
  }
}
