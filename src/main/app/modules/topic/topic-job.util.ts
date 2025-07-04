import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'

export async function saveTopicsResultAsXlsx(jobId: string, topics: any[]) {
  const excelData = [['제목', '내용'], ...topics.map(item => [item.title, item.content])]
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet(excelData)
  worksheet['!cols'] = [{ width: 40 }, { width: 50 }]
  XLSX.utils.book_append_sheet(workbook, worksheet, '주제 목록')
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  const exportDir = path.join(process.cwd(), 'static/exports')
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true })
  const filePath = path.join(exportDir, `find-topics-${jobId}.xlsx`)
  fs.writeFileSync(filePath, buffer)
}
