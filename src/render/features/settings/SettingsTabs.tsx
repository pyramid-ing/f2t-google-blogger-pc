import { Tabs } from 'antd'
import React, { useState } from 'react'
import AppSettingsForm from './AppSettingsForm'
import GoogleSettingsForm from './GoogleSettingsForm'
import ImageSettingsForm from './ImageSettingsForm'
import AISettingsForm from './AISettingsForm'

const SettingsTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general')

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
