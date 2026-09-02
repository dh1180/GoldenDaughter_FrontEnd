import { useEffect, useState } from 'react'
import './pwa-install.css'

const DISMISS_KEY = 'golden-daughter-pwa-dismissed-at'
const APK_GUIDE_KEY = 'golden-daughter-apk-guide'
const ONE_DAY = 24 * 60 * 60 * 1000
const APK_URL = '/GoldenDaughter.apk'

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [visible, setVisible] = useState(false)
  const [manual, setManual] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [showApkGuide, setShowApkGuide] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    if (standalone) return

    const ua = window.navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua)
    const android = /android/i.test(ua)
    setIsIos(ios)
    setIsAndroid(android)

    if (android && sessionStorage.getItem(APK_GUIDE_KEY) === '1') {
      setShowApkGuide(true)
      return
    }

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0)
    if (Date.now() - dismissedAt < ONE_DAY) return

    const beforeInstall = (event) => {
      // Android에서는 브라우저 종류와 관계없이 PWA 대신 최신 APK 설치만 제공한다.
      if (android) {
        event.preventDefault()
        return
      }

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
    }, android ? 500 : 1400)

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

  const closeApkGuide = () => {
    sessionStorage.removeItem(APK_GUIDE_KEY)
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setShowApkGuide(false)
  }

  const downloadApk = () => {
    sessionStorage.setItem(APK_GUIDE_KEY, '1')
    setVisible(false)
    setShowApkGuide(true)

    const link = document.createElement('a')
    link.href = `${APK_URL}?v=${Date.now()}`
    link.download = 'GoldenDaughter.apk'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const install = async () => {
    if (isAndroid) {
      downloadApk()
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

  if (showApkGuide) {
    return (
      <div className="install-backdrop" role="dialog" aria-modal="true" aria-label="APK 설치 안내">
        <section className="install-card">
          <button className="install-close" onClick={closeApkGuide} aria-label="닫기">×</button>
          <img src="/icon-192.png" alt="" className="install-icon" />
          <div>
            <p className="install-eyebrow">APK DOWNLOAD</p>
            <h2>다운로드한 APK를 열어주세요</h2>
            <p>Android 보안 정책상 웹사이트가 다운로드한 APK의 설치 화면을 자동으로 실행할 수는 없습니다.</p>
          </div>

          <div className="install-guide">
            ① 브라우저의 다운로드 목록을 여세요.<br />
            ② <strong>GoldenDaughter.apk</strong>를 선택하세요.<br />
            ③ 처음 한 번 “알 수 없는 앱 설치” 권한을 허용하세요.<br />
            ④ 설치를 누르면 완료됩니다.
          </div>

          <div className="install-actions single-action">
            <button className="install-now" onClick={closeApkGuide}>확인</button>
          </div>
        </section>
      </div>
    )
  }

  if (!visible) return null

  const title = isAndroid ? 'GoldenDaughter Android 앱 설치' : '홈 화면에 앱으로 추가하세요'
  const description = isAndroid
    ? 'Chrome, Brave, Samsung Internet 등 Android 브라우저에서는 모두 최신 APK를 내려받아 설치합니다.'
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

        {isAndroid && (
          <div className="install-guide">
            <strong>APK 다운로드</strong>를 누른 뒤 브라우저 다운로드 목록에서 <strong>GoldenDaughter.apk</strong>를 열어 설치하세요. 앱은 Android 16(API 36)을 대상으로 빌드됩니다.
          </div>
        )}

        {!isAndroid && manual && !deferredPrompt && (
          <div className="install-guide">
            {isIos
              ? 'iPhone/iPad에서는 APK를 설치할 수 없습니다. Safari의 공유 버튼을 누른 뒤 “홈 화면에 추가”를 선택하세요.'
              : '이 기기에서는 브라우저 메뉴에서 “앱 설치” 또는 “홈 화면에 추가”를 선택하세요.'}
          </div>
        )}

        <div className="install-actions">
          <button className="install-later" onClick={close}>나중에</button>
          <button className="install-now" onClick={install}>
            {isAndroid ? 'APK 다운로드' : deferredPrompt ? '앱 설치' : '설치 방법 보기'}
          </button>
        </div>
      </section>
    </div>
  )
}
