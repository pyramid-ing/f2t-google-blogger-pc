const axios = require('axios')

async function testCrawlAPI() {
  try {
    console.log('크롤링 작업 테스트 시작...')

    const response = await axios.post(
      'http://localhost:3000/crawl/add-job',
      {
        url: 'https://example.com',
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )

    console.log('성공:', response.data)
  } catch (error) {
    console.error('에러:', error.response?.data || error.message)
  }
}

// 여러 URL 테스트
async function testMultipleUrls() {
  const urls = ['https://example.com', 'https://httpbin.org/html', 'https://jsonplaceholder.typicode.com']

  for (const url of urls) {
    try {
      console.log(`\n테스트 URL: ${url}`)
      const response = await axios.post('http://localhost:3000/crawl/add-job', {
        url,
      })
      console.log('작업 ID:', response.data.jobId)
    } catch (error) {
      console.error('에러:', error.response?.data || error.message)
    }

    // 1초 대기
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}

if (require.main === module) {
  console.log('사용법:')
  console.log('node test-crawl.js single  # 단일 URL 테스트')
  console.log('node test-crawl.js multiple  # 여러 URL 테스트')

  const mode = process.argv[2] || 'single'

  if (mode === 'multiple') {
    testMultipleUrls()
  } else {
    testCrawlAPI()
  }
}
