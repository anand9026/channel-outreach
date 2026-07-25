import './App.css'
import { Layout } from './components/Layout'
import { CampaignsHub } from './pages/CampaignsHub'
import { InboxV2 } from './pages/InboxV2'
import { ResultsV2 } from './pages/ResultsV2'
import { TemplatesLib } from './pages/TemplatesLib'
import { WhatsAppStoreProvider, useWhatsAppStore } from './store/WhatsAppStore'

function Router() {
  const { state } = useWhatsAppStore()
  switch (state.activeTab) {
    case 'inbox':
      return <InboxV2 />
    case 'templates':
      return <TemplatesLib />
    case 'analytics':
      return <ResultsV2 />
    case 'floor':
    case 'campaigns':
    case 'connect':
    default:
      return <CampaignsHub />
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
