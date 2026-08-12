import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ApiError,
  completeWhatsAppConnect,
  getWhatsAppConnectConfig,
  type WhatsAppConnectConfig,
  type WhatsAppConnectResult,
} from '../lib/api'
import { useWhatsAppStore } from '../store/WhatsAppStore'

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void
      login: (
        cb: (response: {
          authResponse?: { code?: string }
          status?: string
        }) => void,
        opts: Record<string, unknown>,
      ) => void
    }
    fbAsyncInit?: () => void
  }
}

type EmbeddedSignupSession = {
  waba_id?: string
  phone_number_id?: string
  display_phone_number?: string
  business_id?: string
}

const FB_SDK_URL = 'https://connect.facebook.net/en_US/sdk.js'

function loadFacebookSdk(appId: string): Promise<void> {
  if (window.FB) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const existing = document.getElementById('facebook-jssdk')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load Facebook SDK')),
      )
      if (window.FB) resolve()
      return
    }

    window.fbAsyncInit = () => {
      window.FB?.init({
        appId,
        cookie: true,
        xfbml: false,
        version: 'v21.0',
      })
      resolve()
    }

    const script = document.createElement('script')
    script.id = 'facebook-jssdk'
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.src = FB_SDK_URL
    script.onerror = () => reject(new Error('Failed to load Facebook SDK'))
    document.body.appendChild(script)
  })
}

type Props = {
  userId?: string
  orgId?: string
  onConnected?: (result: WhatsAppConnectResult) => void
  className?: string
  testId?: string
}

export function WhatsAppEmbeddedSignupButton({
  userId,
  orgId,
  onConnected,
  className,
  testId = 'wa-embedded-signup',
}: Props) {
  const { actions } = useWhatsAppStore()
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<WhatsAppConnectConfig | null>(null)
  const sessionRef = useRef<EmbeddedSignupSession>({})

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin !== 'https://www.facebook.com' &&
        event.origin !== 'https://web.facebook.com'
      ) {
        return
      }
      if (typeof event.data !== 'string') return
      try {
        const payload = JSON.parse(event.data) as {
          type?: string
          event?: string
          data?: EmbeddedSignupSession
        }
        if (payload.type !== 'WA_EMBEDDED_SIGNUP') return
        if (payload.event === 'FINISH' || payload.event === 'FINISH_ONLY_WABA') {
          sessionRef.current = payload.data || {}
        }
      } catch {
        // ignore non-json messages
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const ensureConfig = useCallback(async () => {
    if (config) return config
    const next = await getWhatsAppConnectConfig({ user_id: userId, org_id: orgId })
    setConfig(next)
    await loadFacebookSdk(next.app_id)
    return next
  }, [config, orgId, userId])

  const connect = async () => {
    setLoading(true)
    sessionRef.current = {}
    try {
      const cfg = await ensureConfig()
      if (!window.FB) {
        throw new Error('Facebook SDK is not available')
      }

      const authCode = await new Promise<string>((resolve, reject) => {
        window.FB!.login(
          (response) => {
            const code = response.authResponse?.code
            if (code) return resolve(code)
            reject(new Error('Meta login was cancelled or did not return a code'))
          },
          {
            config_id: cfg.config_id,
            response_type: 'code',
            override_default_response_type: true,
            extras: {
              setup: {},
              featureType: '',
              sessionInfoVersion: '3',
            },
          },
        )
      })

      const session = sessionRef.current
      const result = await completeWhatsAppConnect({
        code: authCode,
        state: cfg.state,
        org_id: cfg.org_id,
        user_id: cfg.user_id,
        waba_id: session.waba_id,
        phone_number_id: session.phone_number_id,
        display_phone_number: session.display_phone_number,
      })

      actions.connectWhatsApp({
        displayName: result.display_name || result.display_phone_number || 'WhatsApp Business',
        phoneDisplay: result.display_phone_number || '',
        phoneNumberId: result.phone_number_id,
        wabaId: result.waba_id,
        businessId: session.business_id || '',
      })

      onConnected?.(result)
    } catch (err) {
      actions.toast(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to connect WhatsApp',
        'error',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      className={className || 'rx-btn primary'}
      disabled={loading}
      onClick={() => void connect()}
      data-testid={testId}
    >
      {loading ? (
        <>
          <Loader2 size={14} className="spin" /> Connecting…
        </>
      ) : (
        'Continue with Facebook'
      )}
    </button>
  )
}
