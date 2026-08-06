import './App.css'
import { CommandPalette } from './components/CommandPalette'
import { KeyboardShortcuts } from './components/KeyboardShortcuts'
import { Layout } from './components/Layout'
import { CampaignsHub } from './pages/CampaignsHub'
import { ConnectPage } from './pages/ConnectPage'
import { HomePage } from './pages/HomePage'
import { InboxV2 } from './pages/InboxV2'
import { QuickSendPage } from './pages/QuickSendPage'
import { ResultsV2 } from './pages/ResultsV2'
import { TemplatesLib } from './pages/TemplatesLib'
import { WhatsAppStoreProvider, useWhatsAppStore } from './store/WhatsAppStore'
import { normalizeTab } from './types'

function Router() {
  const { state } = useWhatsAppStore()
  switch (normalizeTab(state.activeTab)) {
    case 'overview':
      return <HomePage />
    case 'inbox':
      return <InboxV2 />
    case 'templates':
      return <TemplatesLib />
    case 'reports':
      return <ResultsV2 />
    case 'channels':
      return <ConnectPage />
    case 'campaigns':
      return <CampaignsHub />
    case 'quicksend':
      return <QuickSendPage />
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
      <CommandPalette />
      <KeyboardShortcuts />
    </WhatsAppStoreProvider>
  )
}
