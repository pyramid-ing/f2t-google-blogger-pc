import { Tabs } from 'antd'
import React, { useState, useEffect } from 'react'
import AppSettingsForm from './AppSettingsForm'
import GoogleSettingsForm from './GoogleSettingsForm'
import ImageSettingsForm from './ImageSettingsForm'
import AISettingsForm from './AISettingsForm'
import { getAppSettingsFromServer } from '../../api'
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
        //   children: <ThumbnailSettingsForm initialSettings={settings} />,
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
