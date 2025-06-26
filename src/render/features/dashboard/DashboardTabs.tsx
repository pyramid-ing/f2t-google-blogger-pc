import { Tabs, Button, Input, Upload, message } from 'antd'
import React from 'react'
import { UploadOutlined } from '@ant-design/icons'
import { findTopics } from '../../api'
import { saveAs } from 'file-saver'

const TopicExtraction: React.FC = () => {
  const [topic, setTopic] = React.useState('')
  const [limit, setLimit] = React.useState(10)
  const [loading, setLoading] = React.useState(false)

  const handleFindTopics = async () => {
    setLoading(true)

    try {
      const response = await findTopics(topic, limit)
      const blob = new Blob([response], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      saveAs(blob, `${topic}.xlsx`)
      // const url = window.URL.createObjectURL(blob)
      // const a = document.createElement('a')
      // a.href = url
      // a.download = `${topic}.xlsx`
      // document.body.appendChild(a)
      // a.click()
      // a.remove()
      // window.URL.revokeObjectURL(url)
      message.success('엑셀 파일이 다운로드되었습니다.')
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
  return (
    <div style={{ padding: 16 }}>
      <Upload accept=".xlsx">
        <Button icon={<UploadOutlined />}>엑셀 파일 선택</Button>
      </Upload>
      <Button type="primary" style={{ marginTop: 16 }}>
        업로드
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
