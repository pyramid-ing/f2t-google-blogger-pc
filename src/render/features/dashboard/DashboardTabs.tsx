import { Tabs, Button, Input, Upload, message } from 'antd'
import React, { useState } from 'react'
import { UploadOutlined } from '@ant-design/icons'
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
  const [isPosting, setIsPosting] = useState(false)

  const handleFileUpload = async (file: File) => {
    setIsPosting(true)
    try {
      const response = await registerWorkflow(file)
      console.log('Upload successful:', response)
    } catch (error) {
      console.error('Error uploading the file:', error)
    } finally {
      setIsPosting(false)
    }
  }

  const handleStartPosting = () => {
    if (file) {
      handleFileUpload(file)
    } else {
      console.error('No file selected')
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <Upload
        accept=".xlsx"
        beforeUpload={file => {
          setFile(file)
          return false // Prevent automatic upload
        }}
      >
        <Button icon={<UploadOutlined />}>엑셀 파일 선택</Button>
      </Upload>
      <Button type="primary" style={{ marginTop: 16 }} onClick={handleStartPosting} loading={isPosting}>
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
