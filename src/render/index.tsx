import { StyleProvider } from '@ant-design/cssinjs'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter as Router } from 'react-router-dom'
import App from './pages/app'
import './styles/global.css'

// React-Konva 썸네일 생성을 위한 전역 함수 등록
import { setupKonvaThumbnailGenerator } from './utils/konvaThumbnailGenerator'

// 전역 함수 설정
setupKonvaThumbnailGenerator()

const container = document.getElementById('root') as HTMLElement
const root = createRoot(container)
root.render(
  <StyleProvider hashPriority="high">
    <Router>
      <App />
    </Router>
  </StyleProvider>,
)
