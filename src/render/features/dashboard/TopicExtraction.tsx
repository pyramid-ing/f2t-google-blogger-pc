import { Button, Input, message } from 'antd'
import React from 'react'
import { addTopicJob } from '../../api'

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
        주제 찾기 작업 등록
      </Button>
    </div>
  )
}

export default TopicExtraction
