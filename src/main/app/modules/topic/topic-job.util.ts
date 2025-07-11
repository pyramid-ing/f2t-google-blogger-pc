import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import { EnvConfig } from '@main/config/env.config'

export async function saveTopicsResultAsXlsx(jobId: string, topics: any[]) {
  // 예약날짜 필드 추가(공란)
  const topicsWithDate = topics.map(item => ({
    제목: item.title,
    내용: item.content,
    예약날짜: '',
  }))

  // 엑셀 시트 생성 (topics 객체 배열 그대로 사용)
  const worksheet = XLSX.utils.json_to_sheet(topicsWithDate)

  // 컬럼 너비 설정
  worksheet['!cols'] = [
    { width: 40 }, // 제목
    { width: 80 }, // 내용
    { width: 20 }, // 예약날짜
  ]

  // 워크북에 시트 추가
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '주제 목록')

  // 파일 저장 (리팩토링)
  try {
    if (!fs.existsSync(EnvConfig.exportsDir)) {
      fs.mkdirSync(EnvConfig.exportsDir, { recursive: true })
    }
    const xlsxFilePath = path.join(EnvConfig.exportsDir, `find-topics-${jobId}.xlsx`)
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    fs.writeFileSync(xlsxFilePath, buffer)
  } catch (err) {
    // 에러 발생 시 로깅 또는 예외 처리
    console.error('엑셀 파일 저장 중 오류:', err)
    throw err
  }
}
