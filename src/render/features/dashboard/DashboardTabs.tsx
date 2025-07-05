import { Tabs, Button, Input, Upload, message } from 'antd'
import React, { useState } from 'react'
import { InboxOutlined } from '@ant-design/icons'
import { addTopicJob, registerWorkflow } from '../../api'

const TopicExtraction: React.FC = () => {
  const [topic, setTopic] = React.useState('')
  const [limit, setLimit] = React.useState(10)
  const [loading, setLoading] = React.useState(false)

  const handleFindTopics = async () => {
    setLoading(true)

    try {
      await addTopicJob(topic, limit)
      message.success(`${topic}에 대한 주제찾기 작업이 등록되었습니다.`)
    } catch (e: any) {
      message.error(e?.message || '엑셀 내보내기에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Input
        placeholder="주제 입력"
        value={topic}
        onChange={e => setTopic(e.target.value)}
        style={{ marginBottom: 8 }}
      />
      <Input
        placeholder="제한"
        type="number"
        value={limit}
        onChange={e => setLimit(Number(e.target.value))}
        style={{ marginBottom: 8 }}
      />
      <Button type="primary" onClick={handleFindTopics} loading={loading}>
        주제 찾기
      </Button>
    </div>
  )
}

const Posting: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [fileList, setFileList] = useState<any[]>([])
  const [isPosting, setIsPosting] = useState(false)

  const handleFileUpload = async (file: File) => {
    setIsPosting(true)
    try {
      const response = await registerWorkflow(file)
      console.log('Upload successful:', response)
      message.success('엑셀 파일이 성공적으로 업로드되었습니다.')
    } catch (error) {
      console.error('Error uploading the file:', error)
      message.error('파일 업로드에 실패했습니다.')
    } finally {
      setIsPosting(false)
    }
  }

  const handleStartPosting = () => {
    if (file) {
      handleFileUpload(file)
    } else {
      message.warning('먼저 엑셀 파일을 선택해주세요.')
    }
  }

  const handleBeforeUpload = (file: File) => {
    console.log('업로드 전 파일:', file) // 디버깅용

    // 파일 타입 검증
    const isValidType =
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || // xlsx
      file.type === 'application/vnd.ms-excel' || // xls
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls')

    if (!isValidType) {
      message.error('xlsx 또는 xls 파일만 업로드 가능합니다.')
      return false
    }

    // 파일 크기 검증 (10MB 제한)
    const isLt10M = file.size / 1024 / 1024 < 10
    if (!isLt10M) {
      message.error('파일 크기는 10MB를 초과할 수 없습니다.')
      return false
    }

    setFile(file)
    setFileList([
      {
        uid: '-1',
        name: file.name,
        status: 'done',
        originFileObj: file,
      },
    ])
    message.success(`${file.name} 파일이 선택되었습니다.`)
    console.log('파일 설정 완료:', file) // 디버깅용

    return false // 자동 업로드 방지
  }

  const handleRemove = (file: any) => {
    console.log('파일 제거:', file) // 디버깅용
    setFile(null)
    setFileList([])
    message.info('선택된 파일이 제거되었습니다.')
    return true
  }

  return (
    <div style={{ padding: 16 }}>
      <Upload.Dragger
        accept=".xlsx,.xls"
        multiple={false}
        maxCount={1}
        beforeUpload={handleBeforeUpload}
        onRemove={handleRemove}
        fileList={fileList}
        style={{ marginBottom: 16 }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">여기를 클릭하거나 엑셀 파일을 드래그하여 업로드하세요</p>
        <p className="ant-upload-hint">xlsx, xls 파일만 지원됩니다. (최대 10MB)</p>
      </Upload.Dragger>

      <Button type="primary" onClick={handleStartPosting} loading={isPosting} disabled={!file} block size="large">
        {isPosting ? '포스팅 중...' : '포스팅 시작'}
      </Button>
    </div>
  )
}

const DashboardTabs: React.FC = () => {
  return (
    <Tabs
      defaultActiveKey="google-blogger-excel-upload"
      size="large"
      items={[
        {
          key: 'topic-extraction',
          label: '주제 추출',
          children: <TopicExtraction />,
        },
        {
          key: 'posting',
          label: '포스팅',
          children: <Posting />,
        },
      ]}
    />
  )
}

export default DashboardTabs
