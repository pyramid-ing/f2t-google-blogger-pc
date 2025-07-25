import { Injectable, Logger } from '@nestjs/common'
import { chromium, Browser, Page } from 'playwright'
import fs from 'fs'
import path from 'path'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

export interface TistoryPostOptions {
  title: string
  contentHtml: string
  url: string
  keywords: string[]
  category?: string // 카테고리명(선택)
  kakaoId?: string // 카카오 아이디(선택)
  kakaoPw?: string // 카카오 비번(선택)
  postVisibility?: 'public' | 'private' | 'protected' // 공개범위(선택)
}

@Injectable()
export class TistoryService {
  private readonly logger = new Logger(TistoryService.name)

  /**
   * 쿠키 파일 경로를 가져오는 함수
   */
  private getCookiePath(kakaoId: string = 'default'): string {
    const isProd = process.env.NODE_ENV === 'production'
    const cookieDir = isProd ? process.env.COOKIE_DIR : path.join(process.cwd(), 'static', 'cookies')
    if (!fs.existsSync(cookieDir)) fs.mkdirSync(cookieDir, { recursive: true })
    const kakaoIdForFile = kakaoId.replace(/[^a-zA-Z0-9_\-]/g, '_')
    return path.join(cookieDir, `tistory_${kakaoIdForFile}.json`)
  }

  /**
   * 쿠키를 로드하는 함수
   */
  private async loadCookie(browser: Browser, kakaoId: string = 'default'): Promise<boolean> {
    try {
      const cookiePath = this.getCookiePath(kakaoId)
      if (fs.existsSync(cookiePath)) {
        const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'))
        await browser.contexts()[0].addCookies(cookies)
        this.logger.log('쿠키 적용 완료')
        return true
      } else {
        this.logger.warn('쿠키 파일이 존재하지 않습니다. 비로그인 상태로 진행합니다.')
        return false
      }
    } catch (error) {
      this.logger.error('쿠키 로드 중 오류:', error)
      return false
    }
  }

  /**
   * 쿠키를 저장하는 함수
   */
  private async saveCookie(page: Page, kakaoId: string = 'default'): Promise<void> {
    try {
      const cookiePath = this.getCookiePath(kakaoId)
      const cookies = await page.context().cookies()
      fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2), 'utf-8')
      this.logger.log('로그인 후 쿠키 저장 완료')
    } catch (error) {
      this.logger.error('쿠키 저장 중 오류:', error)
    }
  }

  /**
   * HTML 모드로 전환하는 함수
   */
  private async switchToHtmlMode(page: Page): Promise<void> {
    try {
      // 1. HTML 모드 드롭다운 열기 및 HTML 모드 클릭
      await page.waitForSelector('#editor-mode-layer-btn-open', { timeout: 10000 })
      await page.click('#editor-mode-layer-btn-open')
      this.logger.log('에디터 모드 드롭다운 오픈')
      await page.waitForSelector('#editor-mode-html', { timeout: 10000 })
      await page.click('#editor-mode-html')
      this.logger.log('HTML 모드 클릭')
    } catch (e) {
      throw new CustomHttpException(ErrorCode.TISTORY_ELEMENT_NOT_FOUND, {
        message: `HTML 모드 전환 실패: ${e.message}`,
      })
    }
  }

  /**
   * 티스토리 로그인 처리 함수
   */
  private async handleLogin(page: Page, kakaoId?: string, kakaoPw?: string): Promise<void> {
    // 로그인 상태 확인 및 처리
    const currentUrl = page.url()
    if (currentUrl.includes('tistory.com/auth/login')) {
      this.logger.log('티스토리 로그인 페이지 감지, 카카오 계정으로 로그인 시도')
      try {
        await page.waitForSelector('.btn_login.link_kakao_id', { timeout: 10000 })
        await page.click('.btn_login.link_kakao_id')
        await page.waitForURL('**/accounts.kakao.com/**', { timeout: 15000 })
      } catch (e) {
        throw new CustomHttpException(ErrorCode.TISTORY_LOGIN_FAILED, {
          message: `티스토리 로그인 버튼 클릭 실패: ${e.message}`,
        })
      }
    }

    if (page.url().includes('accounts.kakao.com/login')) {
      this.logger.log('카카오 로그인 폼 감지, 계정 입력')
      try {
        await page.waitForSelector('input[name="loginId"]', { timeout: 10000 })
        await page.fill('input[name="loginId"]', kakaoId || 'busidev22@gmail.com')
        await page.waitForSelector('input[name="password"]', { timeout: 10000 })
        await page.fill('input[name="password"]', kakaoPw || 'tkfkdgo1')
        await page.waitForSelector('button[type="submit"].btn_g.highlight.submit', { timeout: 10000 })
        await page.click('button[type="submit"].btn_g.highlight.submit')
        await page.waitForURL('**/moneys2b.tistory.com/**', { timeout: 15000 })
        this.logger.log('카카오 로그인 완료')
        // 로그인 성공 후 쿠키 저장
        await this.saveCookie(page, kakaoId)
      } catch (e) {
        throw new CustomHttpException(ErrorCode.TISTORY_LOGIN_FAILED, {
          message: `카카오 로그인 실패: ${e.message}`,
        })
      }
    }
  }

  async createBrowserSession(): Promise<{ browser: Browser; page: Page }> {
    const launchOptions: any = {
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--lang=ko-KR,ko',
      ],
    }
    if (process.env.NODE_ENV === 'production' && process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = ''
    }
    const browser = await chromium.launch(launchOptions)
    const page: Page = await browser.newPage()
    await page.setExtraHTTPHeaders({
      'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    })

    // window.confirm(임시글) 핸들러: 임시글 관련 메시지면 취소
    page.on('dialog', async dialog => {
      const msg = dialog.message()
      if (msg.includes('저장된 글이 있습니다.')) {
        this.logger.warn('임시글 관련 confirm 감지, 자동 취소')
        await dialog.dismiss()
      } else {
        await dialog.accept()
      }
    })

    // 쿠키 로드
    await this.loadCookie(browser)

    const defaultUrl = 'https://moneys2b.tistory.com/manage/newpost'
    await page.goto(defaultUrl, { waitUntil: 'networkidle', timeout: 60000 })
    this.logger.log('티스토리 새글 작성 페이지 접속 완료')

    // 로그인 처리
    await this.handleLogin(page)

    // 로그인 후 새글 작성 페이지로 복귀
    await page.goto(defaultUrl, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForURL(defaultUrl, { timeout: 15000 })

    return { browser, page }
  }

  async closeBrowserSession(browser: Browser): Promise<void> {
    try {
      await browser.close()
      this.logger.log('브라우저 세션 종료 완료')
    } catch (error) {
      this.logger.error('브라우저 세션 종료 중 오류:', error)
    }
  }

  async uploadImage(imagePath: string, page: Page): Promise<string> {
    try {
      // HTML 모드로 전환
      await this.switchToHtmlMode(page)

      // 1. 이미지 업로드
      await page.waitForSelector('#attach-layer-btn', { timeout: 10000 })
      await page.click('#attach-layer-btn')
      await page.waitForSelector('#attach-image', { timeout: 10000 })
      const fileInput = await page.$('#attach-image')
      if (fileInput) {
        await fileInput.setInputFiles(imagePath)
        this.logger.log(`이미지 첨부: ${imagePath}`)
        await page.waitForTimeout(3000) // 업로드 완료 대기
      } else {
        this.logger.warn('#attach-image input을 찾을 수 없습니다.')
        return ''
      }

      // 2. 에디터에서 이미지 URL 추출
      const imageUrl = await page.evaluate(() => {
        const codeMirror = document.querySelector('.CodeMirror-code')
        if (codeMirror) {
          const text = codeMirror.textContent || ''
          // 티스토리 이미지 형식 전체 추출 - 간단한 버전
          const imgMatch = text.match(/\[##.*?##\]/)
          return imgMatch ? imgMatch[0] : ''
        }
        return ''
      })

      // 3. 에디터 내용 삭제 (원래 상태로 복원)
      await page.evaluate(() => {
        const codeMirror = document.querySelector('.CodeMirror-code')
        if (codeMirror) {
          // 모든 텍스트 노드 제거
          while (codeMirror.firstChild) {
            codeMirror.removeChild(codeMirror.firstChild)
          }
        }
      })

      this.logger.log(`이미지 업로드 완료: ${imageUrl}`)
      return imageUrl || ''
    } catch (error) {
      this.logger.error('이미지 업로드 중 오류:', error)
      return ''
    }
  }

  /**
   * 브라우저 세션을 내부적으로 관리하는 이미지 업로드 메서드
   */
  async uploadImageWithBrowser(imagePath: string, kakaoId?: string): Promise<string> {
    let browser: Browser | null = null
    try {
      // 브라우저 세션 생성
      const session = await this.createBrowserSession()
      browser = session.browser
      const page = session.page

      // 쿠키 로드
      await this.loadCookie(browser, kakaoId)

      // 이미지 업로드 수행
      const imageUrl = await this.uploadImage(imagePath, page)

      return imageUrl
    } catch (error) {
      this.logger.error('이미지 업로드 세션 중 오류:', error)
      return ''
    } finally {
      // 브라우저 세션 종료
      if (browser) {
        await this.closeBrowserSession(browser)
      }
    }
  }

  async publish(
    options: TistoryPostOptions,
    headless: boolean = true,
  ): Promise<{ success: boolean; message: string; url?: string }> {
    let browser: Browser | null = null
    try {
      const { title, contentHtml, url, keywords, category } = options
      const launchOptions: any = {
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--lang=ko-KR,ko',
        ],
      }
      if (process.env.NODE_ENV === 'production' && process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = ''
      }
      browser = await chromium.launch(launchOptions)
      const page: Page = await browser.newPage()
      await page.setExtraHTTPHeaders({
        'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      })

      // window.confirm(임시글) 핸들러: 임시글 관련 메시지면 취소
      page.on('dialog', async dialog => {
        const msg = dialog.message()
        if (msg.includes('저장된 글이 있습니다.')) {
          this.logger.warn('임시글 관련 confirm 감지, 자동 취소')
          await dialog.dismiss()
        } else {
          await dialog.accept()
        }
      })

      // 쿠키 로드
      await this.loadCookie(browser, options.kakaoId)

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
        this.logger.log('티스토리 새글 작성 페이지 접속 완료')
      } catch (e) {
        throw new CustomHttpException(ErrorCode.TISTORY_PAGE_NAVIGATION_FAILED, {
          message: `페이지 접속 실패: ${e.message}`,
        })
      }

      // 로그인 처리
      await this.handleLogin(page, options.kakaoId, options.kakaoPw)

      // HTML 모드로 전환
      await this.switchToHtmlMode(page)

      // 1-2. 카테고리 선택 (선택적)
      if (category) {
        try {
          await page.waitForSelector('#category-layer-btn', { timeout: 10000 })
          await page.click('#category-layer-btn')
          await page.waitForSelector('.category-item', { timeout: 10000 })
          const categoryItems = await page.$$('.category-item')
          for (const item of categoryItems) {
            const text = await item.textContent()
            if (text && text.trim() === category) {
              await item.click()
              this.logger.log(`카테고리 선택: ${category}`)
              break
            }
          }
        } catch (e) {
          this.logger.warn(`카테고리 선택 실패: ${e.message}`)
        }
      }

      // 2. 제목 입력
      try {
        await page.waitForSelector('#post-title-inp', { timeout: 10000 })
        await page.fill('#post-title-inp', title)
        this.logger.log('제목 입력 완료')
      } catch (e) {
        throw new CustomHttpException(ErrorCode.TISTORY_ELEMENT_NOT_FOUND, {
          message: `제목 입력 실패: ${e.message}`,
        })
      }

      // 3. 본문 입력
      try {
        await page.waitForSelector('.CodeMirror-code', { timeout: 10000 })
        await page.click('.CodeMirror-code')
        await page.waitForTimeout(500)
        await page.keyboard.press('Control+A')
        await page.keyboard.press('Backspace')
        await page.keyboard.type(contentHtml)
        this.logger.log('본문 입력 완료')
      } catch (e) {
        throw new CustomHttpException(ErrorCode.TISTORY_ELEMENT_NOT_FOUND, {
          message: `본문 입력 실패: ${e.message}`,
        })
      }

      // 4. 태그 입력
      try {
        await page.waitForSelector('#tagText', { timeout: 10000 })
        await page.click('#tagText')
        for (const keyword of keywords) {
          await page.fill('#tagText', keyword)
          await page.keyboard.press('Enter')
          await page.waitForTimeout(100)
        }
        this.logger.log('태그 입력')
      } catch (e) {
        throw new CustomHttpException(ErrorCode.TISTORY_ELEMENT_NOT_FOUND, {
          message: `태그 입력 실패: ${e.message}`,
        })
      }

      // 5. 게시 버튼 클릭
      try {
        await page.waitForTimeout(1000)
        await page.waitForSelector('#publish-layer-btn', { timeout: 10000 })
        await page.click('#publish-layer-btn')
        this.logger.log('게시 버튼 클릭')
      } catch (e) {
        throw new CustomHttpException(ErrorCode.TISTORY_ELEMENT_NOT_FOUND, {
          message: `게시 버튼 클릭 실패: ${e.message}`,
        })
      }

      // 6. 발행 팝업 처리: 공개범위 선택, 공개 발행 버튼 클릭
      try {
        await page.waitForTimeout(1000)
        await page.waitForSelector('.ReactModal__Content.editor_layer', { timeout: 10000 })
        // 공개/비공개/보호 라디오버튼 선택
        const visibility = options.postVisibility || 'public'
        let radioSelector = '#open20' // 공개
        if (visibility === 'private') radioSelector = '#open0'
        if (visibility === 'protected') radioSelector = '#open15'
        await page.waitForSelector(radioSelector, { timeout: 10000 })
        await page.evaluate(sel => {
          const radio = document.querySelector(sel) as HTMLInputElement
          if (radio && !radio.checked) radio.click()
        }, radioSelector)
        this.logger.log(
          `${visibility === 'public' ? '공개' : visibility === 'private' ? '비공개' : '보호'} 라디오버튼 선택`,
        )
        // 공개 발행 버튼 클릭
        await page.waitForSelector('#publish-btn', { timeout: 10000 })
        await page.click('#publish-btn')
        this.logger.log('공개 발행 버튼 클릭')
      } catch (e) {
        throw new CustomHttpException(ErrorCode.TISTORY_POST_FAILED, {
          message: `발행 팝업 처리 실패: ${e.message}`,
        })
      }

      // 7. 게시 성공 확인(간단히 3초 대기)
      await page.waitForTimeout(3000)

      // 8. 등록된 글의 URL 추출
      let postUrl = null
      // 등록 대상 블로그 도메인 추출
      const urlObj = new URL(url)
      const manageUrl = urlObj.origin + '/manage/posts/'
      await page.goto(manageUrl, { waitUntil: 'networkidle', timeout: 20000 })
      await page.waitForSelector('.wrap_list .list_post .post_cont .tit_post a', { timeout: 10000 })
      postUrl = await page.evaluate(title => {
        const items = document.querySelectorAll('.wrap_list .list_post .post_cont .tit_post a')
        for (const a of Array.from(items)) {
          const text = a.textContent?.replace(/\s+/g, ' ').trim()
          if (text && title && text.includes(title)) {
            return a.getAttribute('href')
          }
        }
        return null
      }, title)
      return { success: true, message: '티스토리 블로그 글 등록 성공', url: postUrl }
    } catch (e) {
      this.logger.error('티스토리 블로깅 실패: ' + e.message)
      if (e instanceof CustomHttpException) {
        throw e
      }
      throw new CustomHttpException(ErrorCode.TISTORY_POST_FAILED, {
        message: `티스토리 블로깅 실패: ${e.message}`,
      })
    } finally {
      if (browser) {
        try {
          await browser.close()
        } catch {}
      }
    }
  }
}
