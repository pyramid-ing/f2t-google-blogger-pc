import React, { useState, useEffect } from 'react'
import { Form, Switch, Button, message } from 'antd'
import { useRecoilState } from 'recoil'
import { settingsState } from '../../atoms/settings'
import { getSettings, updateSettings } from '@render/api'

const LinkSettingsForm: React.FC = () => {
  const [settings, setSettings] = useRecoilState(settingsState)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await getSettings()
        setSettings(prev => ({
          ...prev,
          linkEnabled: data.linkEnabled || false,
        }))
      } catch (error) {
        console.error('설정을 불러오는데 실패했습니다:', error)
        message.error('설정을 불러오는데 실패했습니다.')
      }
    }

    loadSettings()
  }, [])

  const handleChange = (field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const currentSettings = await getSettings()

      const updatedSettings = await updateSettings({
        ...currentSettings,
        linkEnabled: settings.linkEnabled,
      })

      setSettings(prev => ({
        ...prev,
        ...updatedSettings,
      }))
      message.success('링크 설정이 저장되었습니다.')
    } catch (error) {
      console.error('링크 설정 저장 오류:', error)
      message.error('링크 설정 저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form layout="vertical">
      <Form.Item label="링크 생성 활성화">
        <Switch checked={settings.linkEnabled} onChange={checked => handleChange('linkEnabled', checked)} />
      </Form.Item>

      <Form.Item>
        <Button type="primary" onClick={handleSave} loading={loading}>
          설정 저장
        </Button>
      </Form.Item>
    </Form>
  )
}

export default LinkSettingsForm
