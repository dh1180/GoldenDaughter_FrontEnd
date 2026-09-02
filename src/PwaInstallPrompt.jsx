import { useEffect, useState } from 'react'
import './pwa-install.css'

const DISMISS_KEY = 'golden-daughter-pwa-dismissed-at'
const ONE_DAY = 24 * 60 * 60 * 1000

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [visible, setVisible] = useState(false)
  const [manual, setManual] = useState(false)
  const [isIos, setIsIos] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    if (standalone) return

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0)
    if (Date.now() - dismissedAt < ONE_DAY) return

    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    setIsIos(ios)

    const beforeInstall = (event) => {
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
    }, 1400)

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

  return (
    <div className="install-backdrop" role="dialog" aria-modal="true" aria-label="앱 설치 안내">
      <section className="install-card">
        <button className="install-close" onClick={close} aria-label="닫기">×</button>
        <img src="/icon-192.png" alt="" className="install-icon" />
        <div>
          <p className="install-eyebrow">GOLDEN DAUGHTER</p>
          <h2>홈 화면에 앱으로 추가하세요</h2>
          <p>브라우저 탭 대신 일반 앱처럼 바로 실행할 수 있습니다.</p>
        </div>

        {manual && !deferredPrompt && (
          <div className="install-guide">
            {isIos
              ? 'Safari의 공유 버튼을 누른 뒤 “홈 화면에 추가”를 선택하세요.'
              : '브라우저 메뉴(⋮)에서 “앱 설치” 또는 “홈 화면에 추가”를 선택하세요.'}
          </div>
        )}

        <div className="install-actions">
          <button className="install-later" onClick={close}>나중에</button>
          <button className="install-now" onClick={install}>{deferredPrompt ? '앱 설치' : '설치 방법 보기'}</button>
        </div>
      </section>
    </div>
  )
}
