import { Layout } from './components/Layout'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { CampaignsPage } from './pages/CampaignsPage'
import { ConnectPage } from './pages/ConnectPage'
import { FloorPage } from './pages/FloorPage'
import { InboxPage } from './pages/InboxPage'
import { TemplatesPage } from './pages/TemplatesPage'
import { WhatsAppStoreProvider, useWhatsAppStore } from './store/WhatsAppStore'

function Router() {
  const { state } = useWhatsAppStore()
  switch (state.activeTab) {
    case 'floor':
      return <FloorPage />
    case 'connect':
      return <ConnectPage />
    case 'templates':
      return <TemplatesPage />
    case 'campaigns':
      return <CampaignsPage />
    case 'inbox':
      return <InboxPage />
    case 'analytics':
      return <AnalyticsPage />
    default:
      return <FloorPage />
  }
}

export default function App() {
  return (
    <WhatsAppStoreProvider>
      <Layout>
        <Router />
      </Layout>
    </WhatsAppStoreProvider>
  )
}
