import { HomeOutlined } from '@ant-design/icons'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardTabs from '../features/dashboard/DashboardTabs'

const Dashboard: React.FC = () => {
  const navigate = useNavigate()

  // 썸네일 샘플 데이터
  const createSampleConfig = (title: string, subtitle: string) => {
    return {
      layout: {
        id: 'sample',
        backgroundImage: 'background_8453dcbb73d2f44c.png',
        elements: [
          {
            id: 'title',
            text: '{{제목}}',
            x: 10,
            y: 30,
            width: 80,
            height: 20,
            fontSize: 60,
            fontFamily: 'BMDOHYEON',
            color: '#ffffff',
            textAlign: 'center' as const,
            fontWeight: 'bold' as const,
            opacity: 1,
            rotation: 0,
            zIndex: 2,
          },
          {
            id: 'subtitle',
            text: '{{부제목}}',
            x: 10,
            y: 55,
            width: 80,
            height: 15,
            fontSize: 36,
            fontFamily: 'BMDOHYEON',
            color: '#ffffff',
            textAlign: 'center' as const,
            fontWeight: 'normal' as const,
            opacity: 0.9,
            rotation: 0,
            zIndex: 2,
          },
        ],
      },
      variables: {
        제목: title,
        부제목: subtitle,
        title,
        subtitle,
      },
      backgroundImagePath: './static/thumbnail/backgrounds/background_8453dcbb73d2f44c.png',
    }
  }

  const goToThumbnailGenerator = (title: string, subtitle: string) => {
    const config = createSampleConfig(title, subtitle)
    const configParam = encodeURIComponent(JSON.stringify(config))
    navigate(`/thumbnail-generator?config=${configParam}`)
  }

  return (
    <div
      style={{
        padding: '24px',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '8px',
          padding: '32px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          width: '100%',
          maxWidth: '800px',
        }}
      >
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <h2 style={{ margin: 0 }}>
            <HomeOutlined style={{ marginRight: 8 }} />
            대시보드
          </h2>
        </div>

        {/*/!* 썸네일 테스트 섹션 *!/*/}
        {/*<Card*/}
        {/*  title={*/}
        {/*    <span>*/}
        {/*      <PictureOutlined style={{ marginRight: 8 }} />*/}
        {/*      썸네일 생성 테스트*/}
        {/*    </span>*/}
        {/*  }*/}
        {/*  style={{ marginBottom: '24px' }}*/}
        {/*>*/}
        {/*  <p style={{ marginBottom: '16px' }}>다양한 샘플 데이터로 썸네일 생성 페이지를 테스트해보세요.</p>*/}

        {/*  <Space direction="vertical" style={{ width: '100%' }}>*/}
        {/*    <Button*/}
        {/*      type="primary"*/}
        {/*      size="large"*/}
        {/*      icon={<PictureOutlined />}*/}
        {/*      onClick={() => goToThumbnailGenerator('AI 혁신 기술', '미래를 바꾸다')}*/}
        {/*      style={{ width: '100%' }}*/}
        {/*    >*/}
        {/*      샘플 1: AI 혁신 기술*/}
        {/*    </Button>*/}

        {/*    <Button*/}
        {/*      type="default"*/}
        {/*      size="large"*/}
        {/*      icon={<PictureOutlined />}*/}
        {/*      onClick={() => goToThumbnailGenerator('블로그 마케팅', '성공의 비밀')}*/}
        {/*      style={{ width: '100%' }}*/}
        {/*    >*/}
        {/*      샘플 2: 블로그 마케팅*/}
        {/*    </Button>*/}

        {/*    <Button*/}
        {/*      type="default"*/}
        {/*      size="large"*/}
        {/*      icon={<PictureOutlined />}*/}
        {/*      onClick={() => goToThumbnailGenerator('개발자 도구', '효율성 극대화')}*/}
        {/*      style={{ width: '100%' }}*/}
        {/*    >*/}
        {/*      샘플 3: 개발자 도구*/}
        {/*    </Button>*/}

        {/*    <Button*/}
        {/*      type="dashed"*/}
        {/*      size="large"*/}
        {/*      icon={<PictureOutlined />}*/}
        {/*      onClick={() => goToThumbnailGenerator('테스트 제목', '테스트 부제목')}*/}
        {/*      style={{ width: '100%' }}*/}
        {/*    >*/}
        {/*      기본 샘플: 테스트 데이터*/}
        {/*    </Button>*/}
        {/*  </Space>*/}
        {/*</Card>*/}

        {/*<Divider />*/}

        <DashboardTabs />
      </div>
    </div>
  )
}

export default Dashboard
