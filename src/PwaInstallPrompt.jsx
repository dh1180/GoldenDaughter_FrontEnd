import { useEffect, useState } from 'react'
import './pwa-install.css'

const DISMISS_KEY = 'golden-daughter-pwa-dismissed-at'
const ONE_DAY = 24 * 60 * 60 * 1000
const APK_URL = '/GoldenDaughter.apk'

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [visible, setVisible] = useState(false)
  const [manual, setManual] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isSamsung, setIsSamsung] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    if (standalone) return

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0)
    if (Date.now() - dismissedAt < ONE_DAY) return

    const ua = window.navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua)
    const samsung = /SamsungBrowser/i.test(ua)
    setIsIos(ios)
    setIsSamsung(samsung)

    const beforeInstall = (event) => {
      // Samsung Internet의 자체 PWA 설치 대신 최신 targetSdk로 빌드한 Android APK를 제공한다.
      if (samsung) return
      event.preventDefault()
      setDeferredPrompt(event)
      setManual(false)
      setVisible(true)
    }

    const installed = () => setVisible(false)
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', installed)

    const timer = window.setTimeout(() => {
      setManual(true)
      setVisible(true)
    }, samsung ? 500 : 1400)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('beforeinstallprompt', beforeInstall)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])

  const close = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  const install = async () => {
    if (isSamsung) {
      window.location.assign(APK_URL)
      return
    }

    if (!deferredPrompt) {
      setManual(true)
      return
    }

    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    if (choice.outcome === 'accepted') setVisible(false)
    else setManual(true)
  }

  if (!visible) return null

  const title = isSamsung ? 'GoldenDaughter Android 앱 설치' : '홈 화면에 앱으로 추가하세요'
  const description = isSamsung
    ? 'Samsung Internet에서는 최신 Android용 APK로 설치합니다.'
    : '브라우저 탭 대신 일반 앱처럼 바로 실행할 수 있습니다.'

  return (
    <div className="install-backdrop" role="dialog" aria-modal="true" aria-label="앱 설치 안내">
      <section className="install-card">
        <button className="install-close" onClick={close} aria-label="닫기">×</button>
        <img src="/icon-192.png" alt="" className="install-icon" />
        <div>
          <p className="install-eyebrow">GOLDEN DAUGHTER</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        {isSamsung && (
          <div className="install-guide">
            APK 다운로드 후 Android가 요청하면 이 브라우저의 “알 수 없는 앱 설치” 권한을 한 번 허용하세요. 앱은 Android 16(API 36)을 대상으로 빌드됩니다.
          </div>
        )}

        {!isSamsung && manual && !deferredPrompt && (
          <div className="install-guide">
            {isIos
              ? 'Safari의 공유 버튼을 누른 뒤 “홈 화면에 추가”를 선택하세요.'
              : '브라우저 메뉴(⋮)에서 “앱 설치” 또는 “홈 화면에 추가”를 선택하세요.'}
          </div>
        )}

        <div className="install-actions">
          <button className="install-later" onClick={close}>나중에</button>
          <button className="install-now" onClick={install}>
            {isSamsung ? 'Android 앱 설치' : deferredPrompt ? '앱 설치' : '설치 방법 보기'}
          </button>
        </div>
      </section>
    </div>
  )
}
