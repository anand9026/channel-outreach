import './App.css'
import { CommandPalette } from './components/CommandPalette'
import { Layout } from './components/Layout'
import { CampaignsHub } from './pages/CampaignsHub'
import { ConnectPage } from './pages/ConnectPage'
import { HomePage } from './pages/HomePage'
import { InboxV2 } from './pages/InboxV2'
import { QuickSendPage } from './pages/QuickSendPage'
import { ResultsV2 } from './pages/ResultsV2'
import { TemplatesLib } from './pages/TemplatesLib'
import { WhatsAppStoreProvider, useWhatsAppStore } from './store/WhatsAppStore'

function Router() {
  const { state } = useWhatsAppStore()
  switch (state.activeTab) {
    case 'home':
      return <HomePage />
    case 'inbox':
      return <InboxV2 />
    case 'templates':
      return <TemplatesLib />
    case 'analytics':
      return <ResultsV2 />
    case 'quicksend':
      return <QuickSendPage />
    case 'connect':
      return <ConnectPage />
    case 'campaigns':
      return <CampaignsHub />
    case 'floor':
    default:
      return <HomePage />
  }
}

export default function App() {
  return (
    <WhatsAppStoreProvider>
      <Layout>
        <Router />
      </Layout>
      <CommandPalette />
    </WhatsAppStoreProvider>
  )
}
