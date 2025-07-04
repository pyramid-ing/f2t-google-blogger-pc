import React from 'react'
import PageContainer from '../components/shared/PageContainer'
import DashboardTabs from '../features/dashboard/DashboardTabs'
import ScheduledPostsTable from '../features/work-management/ScheduledPostsTable'

const Dashboard: React.FC = () => {
  return (
    <PageContainer title="대시보드">
      <DashboardTabs />
      <div style={{ marginTop: '24px' }}>
        <ScheduledPostsTable />
      </div>
    </PageContainer>
  )
}

export default Dashboard
