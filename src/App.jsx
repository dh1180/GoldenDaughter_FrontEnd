import { useEffect, useMemo, useRef, useState } from 'react'
import { api, tokenStore } from './api.js'
import PwaInstallPrompt from './PwaInstallPrompt.jsx'
import {
  exportBackupJson,
  importBackupJson,
  importLegacyData,
  localStatistics,
  markMigrationDone,
  migrationDone,
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
  const [ready, setReady] = useState(false)
  const [migrationNotice, setMigrationNotice] = useState('')

  useEffect(() => {
    const migrate = async () => {
      if (migrationDone()) {
        setReady(true)
        return
      }

      const token = tokenStore.get()
      if (!token) {
        markMigrationDone()
        setReady(true)
        return
      }

      try {
        setMigrationNotice('기존 서버 기록을 이 휴대폰으로 옮기는 중...')
        const [me, streak, stats, checkins] = await Promise.all([
          api('/api/users/me'),
          api('/api/streak'),
          api('/api/statistics'),
          api('/api/checkins?from=2020-01-01&to=2100-12-31'),
        ])
        importLegacyData({ me, streak, stats, checkins })
        setMigrationNotice('기존 서버 기록을 로컬 저장소로 옮겼습니다.')
        tokenStore.clear()
      } catch (err) {
        setMigrationNotice(`기존 서버 기록 자동 이관 실패: ${err.message}`)
      } finally {
        setReady(true)
      }
    }
    migrate()
  }, [])

  return <><PwaInstallPrompt />{ready ? <Dashboard migrationNotice={migrationNotice} /> : <CenteredMessage text={migrationNotice || '로컬 기록을 준비하는 중...'} />}</>
}

function Dashboard({ migrationNotice }) {
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
        {migrationNotice && <p className="card tiny muted">{migrationNotice}</p>}
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
  const [error, setError] = useState('')

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
      {error && <p className="error card">{error}</p>}
      <section className="hero-card">
        <p className="eyebrow">CURRENT STREAK</p>
        {streak?.startedAt ? (
          <>
            <div className="day-number">DAY {day}</div>
            <div className="timer">{formatElapsed(elapsed)}</div>
            <div className="goal-row"><span>다음 목표</span><strong>DAY {nextGoal}</strong></div>
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

      {streak?.startedAt && (
        <button className="danger-link" onClick={() => {
          if (!confirm('현재 기록을 종료하고 DAY 1부터 다시 시작할까요? 이전 기록은 이 기기에 보존됩니다.')) return
          const state = resetLocalStreak()
          setStreak(state.currentStreak)
        }}>기록 리셋</button>
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

  useEffect(() => { load() }, [year, month])

  const selectDay = (date) => {
    setSelected(date)
    setSaved(false)
    const item = byDate[date]
    setStatus(item?.status || 'SUCCESS')
    setMemo(item?.memo || '')
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
        <button className="ghost icon" onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button>
        <strong>{year}. {pad(month + 1)}</strong>
        <button className="ghost icon" onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button>
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

  const importFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      importBackupJson(await file.text())
      setMessage('백업을 복원했습니다.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      event.target.value = ''
    }
  }

  return <div className="stack gap-lg">
    <section className="section-heading"><p className="eyebrow">MY RECORD</p><h1>누적 통계</h1></section>
    <div className="stats-grid">
      <StatCard label="현재 기록" value={`DAY ${stats.currentDay}`} />
      <StatCard label="최고 기록" value={`DAY ${stats.bestDay}`} />
      <StatCard label="성공 체크인" value={`${stats.successCheckIns}회`} />
      <StatCard label="실패 체크인" value={`${stats.failedCheckIns}회`} />
    </div>

    <section className="card">
      <p className="eyebrow">LOCAL STORAGE</p>
      <h2>기록은 이 기기에만 저장됩니다.</h2>
      <p className="muted">앱 데이터 삭제나 브라우저 데이터 초기화 전에 백업 파일을 만들어두세요.</p>
      {state.migratedAt && <p className="tiny muted">서버 기록 이관: {new Date(state.migratedAt).toLocaleString()}</p>}
      <div className="button-grid">
        <button className="primary" onClick={downloadBackup}>백업 파일 저장</button>
        <button className="ghost" onClick={copyBackup}>JSON 복사</button>
      </div>
      <button className="ghost" style={{ width: '100%', marginTop: 10 }} onClick={() => fileRef.current?.click()}>백업 파일 가져오기</button>
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={importFile} style={{ display: 'none' }} />
      {message && <p className="tiny muted">{message}</p>}
    </section>

    <section className="card">
      <p className="eyebrow">KEEP GOING</p>
      <h2>오늘 하루의 기록을 계속 쌓아가세요.</h2>
      <p className="muted">위기 상황은 캘린더의 “위기 있었음” 체크인으로 남길 수 있습니다.</p>
    </section>
  </div>
}

function StatCard({ label, value }) {
  return <section className="stat-card"><span>{label}</span><strong>{value}</strong></section>
}

function Modal({ children, onClose }) {
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section className="modal-card">
      <button className="modal-close" onClick={onClose}>×</button>
      <div className="stack gap-md">{children}</div>
    </section>
  </div>
}

function CenteredMessage({ text, inline = false }) {
  return <div className={inline ? 'center-message inline' : 'center-message'}>{text}</div>
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
