# 크롤링 모듈 (Crawl Module)

이 모듈은 Bull 큐와 Puppeteer를 사용하여 웹 크롤링 작업을 비동기적으로 처리합니다.

## 사전 요구사항

1. **Redis 서버**: Bull 큐가 Redis를 사용하므로 Redis 서버가 실행 중이어야 합니다.
   ```bash
   # macOS (Homebrew)
   brew install redis
   brew services start redis
   
   # 또는 Docker
   docker run -p 6379:6379 redis:alpine
   ```

2. **Google Chrome**: Puppeteer가 Chrome을 사용합니다.
   - macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`

## 구성 요소

### 1. CrawlModule
- Bull 큐를 설정하고 관련 서비스들을 등록합니다.

### 2. CrawlController
- 크롤링 작업을 큐에 추가하는 REST API를 제공합니다.

### 3. CrawlService
- 큐에 작업을 추가하는 비즈니스 로직을 담당합니다.

### 4. CrawlWorkerService
- 실제 크롤링 작업을 처리하는 워커입니다.
- Puppeteer를 사용하여 웹페이지에 접근하고 데이터를 추출합니다.

## API 사용법

### 크롤링 작업 추가

```bash
POST /crawl/add-job
Content-Type: application/json

{
  "url": "https://example.com"
}
```

**응답:**
```json
{
  "message": "크롤링 작업이 성공적으로 추가되었습니다.",
  "jobId": "1",
  "url": "https://example.com"
}
```

## 설정

### Puppeteer 설정
- `executablePath`: Chrome 실행 파일 경로
- `headless`: 브라우저를 백그라운드에서 실행 여부

### Bull 큐 설정
- Redis 연결 정보: `localhost:6379`
- 큐 이름: `crawl`

## 결과 처리

크롤링 완료 후 결과는 다음 URL로 전송됩니다:
- 성공: `https://n8n.pyramid-ing.com/redis/test`
- 실패: 에러 정보와 함께 동일한 URL로 전송

## 주의사항

1. **Chrome 경로**: macOS가 아닌 환경에서는 `executablePath`를 수정해야 합니다.
2. **Redis 연결**: Redis 서버가 실행 중이어야 합니다.
3. **메모리 관리**: 많은 작업이 동시에 실행될 경우 메모리 사용량을 모니터링하세요. 