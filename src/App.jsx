import { useEffect, useMemo, useRef, useState } from 'react'
import PwaInstallPrompt from './PwaInstallPrompt.jsx'
import {
  exportBackupJson,
  importBackupJson,
  parseBackupJson,
  localStatistics,
  readLocalState,
  resetLocalStreak,
  saveLocalCheckin,
  startLocalStreak,
} from './localData.js'

const pad = (n) => String(n).padStart(2, '0')
const todayString = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const localDateTimeValue = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const DC_LIST_URL = 'https://gall.dcinside.com/mgallery/board/lists/?id=hyunjatime&sort_type=N&search_head=190&page=1'

export default function App() {
  useEffect(() => {
    localStorage.removeItem('gd_token')
    localStorage.removeItem('gd_server_migration_done_v1')
  }, [])

  return <><PwaInstallPrompt /><Dashboard /></>
}

function Dashboard() {
  const [tab, setTab] = useState('home')
  const [version, setVersion] = useState(0)
  const state = useMemo(() => readLocalState(), [version])

  useEffect(() => {
    const refresh = () => setVersion((v) => v + 1)
    window.addEventListener('gd-local-data-changed', refresh)
    return () => window.removeEventListener('gd-local-data-changed', refresh)
  }, [])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">GOLDEN DAUGHTER · LOCAL</p>
          <strong>{state.profile?.nickname || '나의 기록'}</strong>
        </div>
        <span className="tiny muted">서버 없음</span>
      </header>

      <main className="content">
        {tab === 'home' && <HomePage />}
        {tab === 'calendar' && <CalendarPage />}
        {tab === 'stats' && <StatisticsPage />}
      </main>

      <nav className="bottom-nav">
        <NavButton active={tab === 'home'} onClick={() => setTab('home')} icon="●" label="홈" />
        <NavButton active={tab === 'calendar'} onClick={() => setTab('calendar')} icon="□" label="기록" />
        <NavButton active={tab === 'stats'} onClick={() => setTab('stats')} icon="▥" label="통계" />
      </nav>
    </div>
  )
}

function NavButton({ active, onClick, icon, label }) {
  return <button className={active ? 'nav-button active' : 'nav-button'} onClick={onClick}><span>{icon}</span>{label}</button>
}

function HomePage() {
  const [streak, setStreak] = useState(() => readLocalState().currentStreak)
  const [quote, setQuote] = useState(null)
  const [posts, setPosts] = useState([])
  const [tick, setTick] = useState(Date.now())
  const [showStart, setShowStart] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const confirmReset = () => {
    try {
      const next = resetLocalStreak()
      setStreak(next.currentStreak)
      setTick(Date.now())
      setShowResetConfirm(false)
      setNotice('현재 기록을 DAY 1부터 다시 시작했습니다. 이전 기록과 체크인은 보존됩니다.')
      setError('')
    } catch {
      setShowResetConfirm(false)
      setError('기록을 저장하지 못했습니다. 저장공간을 확인한 후 다시 시도해주세요.')
    }
  }

  const choosePost = (list) => {
    if (!list?.length) {
      setQuote({ title: '초월 글 모음 바로가기', content: 'GitHub Actions가 초월 글 목록을 갱신합니다.', url: DC_LIST_URL })
      return
    }
    setQuote(list[Math.floor(Math.random() * list.length)])
  }

  useEffect(() => {
    fetch(`/transcendence-posts.json?refresh=${Date.now()}`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : [])
      .then((list) => {
        const safe = Array.isArray(list) ? list : []
        setPosts(safe)
        choosePost(safe)
      })
      .catch(() => choosePost([]))
  }, [])

  useEffect(() => {
    const refresh = () => setStreak(readLocalState().currentStreak)
    window.addEventListener('gd-local-data-changed', refresh)
    return () => window.removeEventListener('gd-local-data-changed', refresh)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const elapsed = useMemo(() => {
    if (!streak?.startedAt) return 0
    return Math.max(0, Math.floor((tick - new Date(streak.startedAt).getTime()) / 1000))
  }, [streak, tick])

  const day = streak?.startedAt ? Math.floor(elapsed / 86400) + 1 : 0
  const nextGoal = [7, 14, 30, 60, 90, 180, 365].find((goal) => goal > day) || day + 30

  return (
    <div className="stack gap-lg">
      {error && <p className="error card" role="alert">{error}</p>}
      {notice && <p className="local-notice" role="status">{notice}</p>}
      <section className="hero-card">
        <p className="eyebrow">CURRENT STREAK</p>
        {streak?.startedAt ? (
          <>
            <div className="day-number">DAY {day}</div>
            <div className="timer">{formatElapsed(elapsed)}</div>
            <div className="goal-row"><span>다음 목표</span><strong>DAY {nextGoal}</strong></div>
            <button type="button" className="reset-trigger" onClick={() => setShowResetConfirm(true)}>
              <span aria-hidden="true">↺</span> 현재 기록 초기화
            </button>
          </>
        ) : (
          <>
            <div className="day-number muted-day">READY</div>
            <p className="muted">아직 시작된 기록이 없습니다.</p>
            <button className="primary" onClick={() => setShowStart(true)}>기록 시작하기</button>
          </>
        )}
      </section>

      {quote && (
        <section className="quote-card">
          <p className="eyebrow">DCINSIDE · 초월</p>
          <h2>{quote.title}</h2>
          {quote.content && <p>{quote.content}</p>}
          {quote.dcPostNo && <p className="tiny muted">글 #{quote.dcPostNo}</p>}
          <div className="button-grid">
            {quote.url && <a className="primary link-button" href={quote.url} target="_blank" rel="noreferrer">원문 보기</a>}
            <button className="ghost" onClick={() => choosePost(posts)}>다른 초월글</button>
          </div>
        </section>
      )}

      {showResetConfirm && (
        <Modal label="현재 기록 초기화 확인" onClose={() => setShowResetConfirm(false)}>
          <p className="eyebrow">RESET STREAK</p>
          <h2>현재 기록을 다시 시작할까요?</h2>
          <p className="muted">진행 중인 연속 기록만 종료하고 지금부터 DAY 1로 시작합니다.</p>
          <div className="reset-preview">
            <div><span>현재 기록</span><strong>DAY {day}</strong></div>
            <span aria-hidden="true" className="reset-arrow">→</span>
            <div><span>초기화 후</span><strong>DAY 1</strong></div>
          </div>
          <p className="tiny muted">기존 체크인, 최고 기록, 지난 연속 기록은 삭제되지 않습니다.</p>
          <div className="reset-actions">
            <button type="button" className="ghost" onClick={() => setShowResetConfirm(false)}>취소</button>
            <button type="button" className="reset-confirm" onClick={confirmReset}>DAY 1부터 다시 시작</button>
          </div>
        </Modal>
      )}

      {showStart && <StartModal onClose={() => setShowStart(false)} onStarted={(s) => { setStreak(s); setShowStart(false) }} />}
    </div>
  )
}

function StartModal({ onClose, onStarted }) {
  const [value, setValue] = useState(localDateTimeValue())
  const [error, setError] = useState('')

  const start = () => {
    setError('')
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      setError('시작 날짜와 시간을 확인해주세요.')
      return
    }
    if (date.getTime() > Date.now()) {
      setError('미래 시간으로는 시작할 수 없습니다.')
      return
    }
    const state = startLocalStreak(date.toISOString())
    onStarted(state.currentStreak)
  }

  return <Modal onClose={onClose}>
    <p className="eyebrow">START STREAK</p>
    <h2>언제부터 시작했나요?</h2>
    <p className="muted">실제 시작 시각은 이 기기에만 저장됩니다.</p>
    <label>시작 날짜/시간<input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} /></label>
    {error && <p className="error">{error}</p>}
    <button className="primary" onClick={start}>이 시간부터 시작</button>
  </Modal>
}

function CalendarPage() {
  const now = new Date()
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [items, setItems] = useState(() => Object.values(readLocalState().checkins))
  const [selected, setSelected] = useState(todayString())
  const [status, setStatus] = useState('SUCCESS')
  const [memo, setMemo] = useState('')
  const [saved, setSaved] = useState(false)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const days = useMemo(() => calendarCells(year, month), [year, month])
  const byDate = useMemo(() => Object.fromEntries(items.map((item) => [item.date, item])), [items])

  const load = () => {
    const nextItems = Object.values(readLocalState().checkins)
    setItems(nextItems)
    const selectedItem = nextItems.find((item) => item.date === selected)
    setStatus(selectedItem?.status || 'SUCCESS')
    setMemo(selectedItem?.memo || '')
  }

  useEffect(() => { load() }, [year, month, selected])

  const selectDay = (date) => {
    setSelected(date)
    setSaved(false)
    const item = readLocalState().checkins[date]
    setStatus(item?.status || 'SUCCESS')
    setMemo(item?.memo || '')
  }

  const moveMonth = (offset) => {
    const next = new Date(year, month + offset, 1)
    const today = new Date()
    const date = next.getFullYear() === today.getFullYear() && next.getMonth() === today.getMonth()
      ? todayString()
      : `${next.getFullYear()}-${pad(next.getMonth() + 1)}-01`
    setCursor(next)
    selectDay(date)
  }

  const save = () => {
    saveLocalCheckin(selected, status, memo)
    load()
    setSaved(true)
  }

  return <div className="stack gap-lg">
    <section className="section-heading"><p className="eyebrow">DAILY CHECK-IN</p><h1>기록 캘린더</h1></section>
    <section className="calendar-card">
      <div className="month-head">
        <button type="button" className="ghost icon" aria-label="이전 달" onClick={() => moveMonth(-1)}>‹</button>
        <strong>{year}. {pad(month + 1)}</strong>
        <button type="button" className="ghost icon" aria-label="다음 달" onClick={() => moveMonth(1)}>›</button>
      </div>
      <div className="weekdays">{['일','월','화','수','목','금','토'].map((d) => <span key={d}>{d}</span>)}</div>
      <div className="calendar-grid">
        {days.map((cell, i) => cell ? <button key={cell.date} onClick={() => selectDay(cell.date)} className={`day-cell ${selected === cell.date ? 'selected' : ''} ${byDate[cell.date]?.status?.toLowerCase() || ''}`}><span>{cell.day}</span><i /></button> : <div key={`blank-${i}`} />)}
      </div>
      <div className="legend"><span>● 성공</span><span>● 위기</span><span>● 실패</span></div>
    </section>

    <section className="card stack gap-md">
      <h3>{selected} 체크인</h3>
      <div className="segmented">
        {[['SUCCESS','성공'],['CRISIS','위기 있었음'],['FAILED','실패']].map(([value,label]) => <button key={value} className={status === value ? 'active' : ''} onClick={() => { setStatus(value); setSaved(false) }}>{label}</button>)}
      </div>
      <textarea rows="3" maxLength="500" placeholder="오늘 어땠는지 간단히 기록" value={memo} onChange={(e) => { setMemo(e.target.value); setSaved(false) }} />
      {saved && <p className="tiny muted">이 기기에 저장했습니다.</p>}
      <button className="primary" onClick={save}>체크인 저장</button>
    </section>
  </div>
}

function StatisticsPage() {
  const [stats, setStats] = useState(() => localStatistics())
  const [state, setState] = useState(() => readLocalState())
  const [message, setMessage] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [pasteValue, setPasteValue] = useState('')
  const [pasteError, setPasteError] = useState('')
  const [pendingRestore, setPendingRestore] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    const refresh = () => {
      setStats(localStatistics())
      setState(readLocalState())
    }
    window.addEventListener('gd-local-data-changed', refresh)
    return () => window.removeEventListener('gd-local-data-changed', refresh)
  }, [])

  const downloadBackup = () => {
    const blob = new Blob([exportBackupJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `GoldenDaughter-backup-${todayString()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setMessage('백업 파일을 만들었습니다.')
  }

  const copyBackup = async () => {
    try {
      await navigator.clipboard.writeText(exportBackupJson())
      setMessage('백업 JSON을 클립보드에 복사했습니다.')
    } catch {
      setMessage('클립보드 복사에 실패했습니다. 브라우저 권한을 확인해주세요.')
    }
  }

  const prepareRestore = (text) => {
    const preview = parseBackupJson(text)
    setPendingRestore({ text, preview })
    setMessage('')
  }

  const importFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      prepareRestore(await file.text())
    } catch (err) {
      setMessage(err.message)
    } finally {
      event.target.value = ''
    }
  }

  const restore = () => {
    if (!pendingRestore) return
    try {
      importBackupJson(pendingRestore.text)
      setMessage('백업이 정상적으로 복원됐습니다.')
      setPendingRestore(null)
      setPasteValue('')
      setPasteError('')
    } catch (err) {
      setMessage(err.message)
      setPendingRestore(null)
    }
  }

  const previousStreaks = [...state.streakHistory]
    .filter((entry) => entry?.startedAt && entry?.endedAt)
    .reverse()
    .slice(0, 5)

  return <div className="stack gap-lg">
    <section className="section-heading"><p className="eyebrow">MY RECORD</p><h1>누적 통계</h1></section>
    <div className="stats-grid">
      <StatCard label="현재 기록" value={`DAY ${stats.currentDay}`} />
      <StatCard label="최고 기록" value={`DAY ${stats.bestDay}`} />
      <StatCard label="성공 체크인" value={`${stats.successCheckIns}회`} />
      <StatCard label="실패 체크인" value={`${stats.failedCheckIns}회`} />
    </div>

    <section className="card">
      <p className="eyebrow">STREAK HISTORY</p>
      <h2>지난 연속 기록</h2>
      {previousStreaks.length ? (
        <div className="history-list">
          {previousStreaks.map((entry, index) => (
            <div key={`${entry.startedAt}-${index}`} className="history-entry">
              <div><strong>DAY {entry.day || 1}</strong><span>{new Date(entry.endedAt).toLocaleDateString('ko-KR')} 종료</span></div>
              <span className="tiny muted">기록 보관됨</span>
            </div>
          ))}
        </div>
      ) : <p className="muted">아직 종료한 연속 기록이 없습니다. 기록을 초기화하면 여기에 남아요.</p>}
    </section>

    <section className="card">
      <p className="eyebrow">LOCAL STORAGE</p>
      <h2>기록은 이 기기에만 저장됩니다.</h2>
      <p className="muted">앱 데이터 삭제나 브라우저 데이터 초기화 전에 백업 파일을 만들어두세요.</p>
      <div className="button-grid">
        <button className="primary" onClick={downloadBackup}>백업 파일 저장</button>
        <button className="ghost" onClick={copyBackup}>JSON 복사</button>
      </div>
      <button className="ghost" style={{ width: '100%', marginTop: 10 }} onClick={() => fileRef.current?.click()}>백업 파일 가져오기</button>
      <button className="text-button" style={{ width: '100%' }} onClick={() => { setPasteError(''); setShowPaste(true) }}>JSON 붙여넣기로 복원</button>
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={importFile} style={{ display: 'none' }} />
      {message && <p className="tiny muted" role="status">{message}</p>}
    </section>

    <section className="card">
      <p className="eyebrow">KEEP GOING</p>
      <h2>오늘 하루의 기록을 계속 쌓아가세요.</h2>
      <p className="muted">위기 상황은 캘린더의 “위기 있었음” 체크인으로 남길 수 있습니다.</p>
    </section>

    {showPaste && (
      <Modal label="JSON 백업 붙여넣기" onClose={() => setShowPaste(false)}>
        <p className="eyebrow">RESTORE BACKUP</p>
        <h2>백업 JSON 붙여넣기</h2>
        <p className="muted">Android에서 파일 선택이 안 될 때는 복사해 둔 JSON을 여기에 붙여넣으세요.</p>
        <textarea aria-label="백업 JSON 내용" rows={8} value={pasteValue} onChange={(e) => { setPasteValue(e.target.value); setPasteError('') }} placeholder="GoldenDaughter 백업 JSON" />
        {pasteError && <p className="error" role="alert">{pasteError}</p>}
        <button className="primary" type="button" disabled={!pasteValue.trim()} onClick={() => {
          try {
            prepareRestore(pasteValue)
            setShowPaste(false)
          } catch (err) {
            setPasteError(err.message)
          }
        }}>복원 내용 확인</button>
      </Modal>
    )}

    {pendingRestore && (
      <Modal label="백업 복원 확인" onClose={() => setPendingRestore(null)}>
        <p className="eyebrow">CONFIRM RESTORE</p>
        <h2>이 백업으로 복원할까요?</h2>
        <p className="muted">복원하면 현재 기기의 기록을 백업 내용으로 교체합니다. 필요하면 먼저 지금 기록을 백업해두세요.</p>
        <div className="restore-preview">
          <span>백업 체크인 <strong>{Object.keys(pendingRestore.preview.checkins).length}개</strong></span>
          <span>백업 지난 기록 <strong>{pendingRestore.preview.streakHistory.length}개</strong></span>
        </div>
        <div className="reset-actions">
          <button type="button" className="ghost" onClick={() => setPendingRestore(null)}>취소</button>
          <button type="button" className="primary" onClick={restore}>이 백업으로 복원</button>
        </div>
      </Modal>
    )}
  </div>
}

function StatCard({ label, value }) {
  return <section className="stat-card"><span>{label}</span><strong>{value}</strong></section>
}

function Modal({ children, onClose, label = '대화상자' }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" className="modal-close" aria-label="닫기" onClick={onClose}>×</button>
      <div className="stack gap-md">{children}</div>
    </section>
  </div>
}

function formatElapsed(total) {
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return `${days}일 ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

function calendarCells(year, month) {
  const cells = Array(new Date(year, month, 1).getDay()).fill(null)
  const last = new Date(year, month + 1, 0).getDate()
  for (let day = 1; day <= last; day++) {
    cells.push({ day, date: `${year}-${pad(month + 1)}-${pad(day)}` })
  }
  return cells
}