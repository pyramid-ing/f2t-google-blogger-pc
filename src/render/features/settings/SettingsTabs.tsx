import { Tabs, message } from 'antd'
import React, { useState, useEffect } from 'react'
import AppSettingsForm from './AppSettingsForm'
import GoogleSettingsForm from './GoogleSettingsForm'
import ImageSettingsForm from './ImageSettingsForm'
import AISettingsForm from './AISettingsForm'
import { getAppSettingsFromServer, saveAppSettingsToServer } from '../../api'
import { AppSettings } from '../../types/settings'

const SettingsTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general')
  const [settings, setSettings] = useState<AppSettings>({})

  // 설정 로드
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await getAppSettingsFromServer()
      setSettings(data || {})
    } catch (error) {
      console.error('설정 로드 실패:', error)
    }
  }

  const handleSaveThumbnailSettings = async (thumbnailSettings: Partial<AppSettings>) => {
    try {
      const updatedSettings = { ...settings, ...thumbnailSettings }
      await saveAppSettingsToServer(updatedSettings)
      setSettings(updatedSettings)
      message.success('썸네일 설정이 저장되었습니다.')
    } catch (error) {
      console.error('썸네일 설정 저장 실패:', error)
      message.error('썸네일 설정 저장에 실패했습니다.')
      throw error
    }
  }

  return (
    <Tabs
      activeKey={activeTab}
      onChange={setActiveTab}
      type="card"
      size="large"
      items={[
        {
          key: 'general',
          label: '일반',
          children: <AppSettingsForm />,
        },
        {
          key: 'google',
          label: '구글',
          children: <GoogleSettingsForm />,
        },
        {
          key: 'image',
          label: '이미지',
          children: <ImageSettingsForm />,
        },
        // {
        //   key: 'thumbnail',
        //   label: '썸네일',
        //   children: <ThumbnailSettingsForm initialSettings={settings} onSave={handleSaveThumbnailSettings} />,
        // },
        {
          key: 'ai',
          label: 'AI',
          children: <AISettingsForm />,
        },
      ]}
    />
  )
}

export default SettingsTabs
