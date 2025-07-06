import React from 'react'
import { Tabs } from 'antd'
import { AISettingsForm } from './AISettingsForm'
import AppSettingsForm from './AppSettingsForm'
import GoogleSettingsForm from './GoogleSettingsForm'
import ImageSettingsForm from './ImageSettingsForm'

const { TabPane } = Tabs

const SettingsTabs: React.FC = () => {
  return (
    <Tabs defaultActiveKey="ai">
      <TabPane tab="AI 설정" key="ai">
        <AISettingsForm />
      </TabPane>
      <TabPane tab="앱 설정" key="app">
        <AppSettingsForm />
      </TabPane>
      <TabPane tab="Google 설정" key="google">
        <GoogleSettingsForm />
      </TabPane>
      <TabPane tab="이미지 설정" key="image">
        <ImageSettingsForm />
      </TabPane>
      {/*<TabPane tab="썸네일 설정" key="thumbnail">*/}
      {/*  <ThumbnailSettingsForm />*/}
      {/*</TabPane>*/}
    </Tabs>
  )
}

export default SettingsTabs
