import { useEffect, useMemo, useState } from 'react'
import { api, apiUrl, tokenStore } from './api.js'

const pad = (n) => String(n).padStart(2, '0')
const todayString = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const localDateTimeValue = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function App() {
  const [token, setToken] = useState(tokenStore.get())
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(Boolean(token))

  useEffect(() => {
    if (!token) return
    api('/api/users/me')
      .then(setMe)
      .catch(() => {
        tokenStore.clear()
        setToken(null)
      })
      .finally(() => setLoading(false))
  }, [token])

  const onAuth = (result) => {
    tokenStore.set(result.token)
    setToken(result.token)
    setMe({ id: result.userId, email: result.email, nickname: result.nickname, createdAt: result.createdAt })
  }

  const logout = () => {
    tokenStore.clear()
    setToken(null)
    setMe(null)
  }

  if (loading) return <CenteredMessage text="기록을 불러오는 중..." />
  if (!token) return <AuthScreen onAuth={onAuth} />
  return <Dashboard me={me} logout={logout} />
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const body = mode === 'signup' ? { email, password, nickname } : { email, password }
      const result = await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify(body) })
      onAuth(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark">GD</div>
        <p className="eyebrow">GOLDEN DAUGHTER</p>
        <h1>오늘의 기록을 지키자.</h1>
        <p className="muted">평소에는 기록을 보고, 위기에는 바로 버튼을 누르세요.</p>

        <form onSubmit={submit} className="stack gap-md">
          <label>이메일<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          {mode === 'signup' && <label>닉네임<input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength="40" required /></label>}
          <label>비밀번호<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength="8" required /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary" disabled={busy}>{busy ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}</button>
        </form>

        <button className="text-button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? '처음이라면 회원가입' : '이미 계정이 있다면 로그인'}
        </button>
        <p className="tiny muted api-note">API: {apiUrl()}</p>
      </section>
    </main>
  )
}

function Dashboard({ me, logout }) {
  const [tab, setTab] = useState('home')
  return (
    <div className="app-shell">
      <header className="topbar">
        <div><p className="eyebrow">GOLDEN DAUGHTER</p><strong>{me?.nickname || '사용자'}</strong></div>
        <button className="ghost small" onClick={logout}>로그아웃</button>
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
  const [streak, setStreak] = useState(null)
  const [quote, setQuote] = useState(null)
  const [tick, setTick] = useState(Date.now())
  const [showStart, setShowStart] = useState(false)
  const [showCrisis, setShowCrisis] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const [s, q] = await Promise.all([api('/api/streak'), api('/api/motivation/quote')])
      setStreak(s)
      setQuote(q)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const elapsed = useMemo(() => {
    if (!streak?.active || !streak.startedAt) return 0
    return Math.max(0, Math.floor((tick - new Date(streak.startedAt).getTime()) / 1000))
  }, [streak, tick])

  const day = streak?.active ? Math.floor(elapsed / 86400) + 1 : 0
  const nextGoal = [7, 14, 30, 60, 90, 180, 365].find((goal) => goal > day) || day + 30

  return (
    <div className="stack gap-lg">
      {error && <p className="error card">{error}</p>}
      <section className="hero-card">
        <p className="eyebrow">CURRENT STREAK</p>
        {streak?.active ? (
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
          <span className="quote-mark">“</span>
          <h2>{quote.title}</h2>
          <p>{quote.content}</p>
          <button className="ghost small" onClick={() => api('/api/motivation/quote').then(setQuote)}>다른 문구</button>
        </section>
      )}

      {streak?.active && (
        <button className="crisis-button" onClick={() => setShowCrisis(true)}>
          <span>🚨</span>
          <strong>지금 진짜 위험함</strong>
          <small>누르면 바로 위기 모드로 들어갑니다</small>
        </button>
      )}

      {streak?.active && (
        <button className="danger-link" onClick={async () => {
          if (!confirm('현재 기록을 종료하고 DAY 1부터 다시 시작할까요? 이전 기록은 보존됩니다.')) return
          const result = await api('/api/streak/reset', { method: 'POST' })
          setStreak(result)
        }}>기록 리셋</button>
      )}

      {showStart && <StartModal onClose={() => setShowStart(false)} onStarted={(s) => { setStreak(s); setShowStart(false) }} />}
      {showCrisis && <CrisisModal day={day} onClose={() => setShowCrisis(false)} />}
    </div>
  )
}

function StartModal({ onClose, onStarted }) {
  const [value, setValue] = useState(localDateTimeValue())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const start = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await api('/api/streak/start', {
        method: 'POST',
        body: JSON.stringify({ startedAt: new Date(value).toISOString() }),
      })
      onStarted(result)
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  return <Modal onClose={onClose}>
    <p className="eyebrow">START STREAK</p>
    <h2>언제부터 시작했나요?</h2>
    <p className="muted">오늘이 아니라 이미 며칠째라면 실제 시작 시각을 넣으면 됩니다.</p>
    <label>시작 날짜/시간<input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} /></label>
    {error && <p className="error">{error}</p>}
    <button className="primary" onClick={start} disabled={busy}>{busy ? '저장 중...' : '이 시간부터 시작'}</button>
  </Modal>
}

function CrisisModal({ day, onClose }) {
  const [intensity, setIntensity] = useState(8)
  const [post, setPost] = useState(null)
  const [busy, setBusy] = useState(false)
  const [seconds, setSeconds] = useState(600)
  const [running, setRunning] = useState(false)
  const [helped, setHelped] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!running || seconds <= 0) return
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [running, seconds])

  const enter = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await api('/api/crisis', { method: 'POST', body: JSON.stringify({ intensity }) })
      setPost(result.postId ? { id: result.postId, title: result.postTitle, url: result.postUrl } : null)
      setRunning(true)
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  const another = async () => {
    const p = await api('/api/motivation/random')
    setPost(p)
    setHelped(false)
  }

  const helpful = async () => {
    if (!post?.id) return
    await api(`/api/motivation/${post.id}/helpful`, { method: 'POST' })
    setHelped(true)
  }

  return <Modal onClose={onClose} crisis>
    <p className="eyebrow danger-text">CRISIS MODE</p>
    <h2>DAY {day}. 여기서 끝내지 말자.</h2>

    {!post ? <>
      <p className="muted">현재 충동 강도를 기록하고 바로 추천글 하나를 띄웁니다.</p>
      <div className="intensity-value">{intensity}<span>/10</span></div>
      <input className="range" type="range" min="1" max="10" value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} />
      {error && <p className="error">{error}</p>}
      <button className="crisis-action" onClick={enter} disabled={busy}>{busy ? '불러오는 중...' : '추천글 바로 보기'}</button>
    </> : <>
      <div className="survive-timer">{pad(Math.floor(seconds / 60))}:{pad(seconds % 60)}</div>
      <p className="muted">10분만 다른 행동을 하면서 버텨보세요.</p>
      <article className="post-card">
        <p className="eyebrow">RANDOM RECOMMENDATION</p>
        <h3>{post.title}</h3>
        {post.url && <a className="primary link-button" href={post.url} target="_blank" rel="noreferrer">전체 글 열기</a>}
      </article>
      <div className="button-grid">
        <button className={helped ? 'ghost success' : 'ghost'} onClick={helpful}>{helped ? '✓ 도움됨 기록' : '👍 도움됨'}</button>
        <button className="ghost" onClick={another}>🔄 다른 글</button>
      </div>
      <button className="text-button" onClick={() => setRunning((v) => !v)}>{running ? '타이머 잠시 멈춤' : '타이머 계속'}</button>
    </>}
  </Modal>
}

function CalendarPage() {
  const now = new Date()
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(todayString())
  const [status, setStatus] = useState('SUCCESS')
  const [memo, setMemo] = useState('')
  const [error, setError] = useState('')

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const days = useMemo(() => calendarCells(year, month), [year, month])
  const byDate = useMemo(() => Object.fromEntries(items.map((item) => [item.date, item])), [items])

  const load = async () => {
    const from = `${year}-${pad(month + 1)}-01`
    const last = new Date(year, month + 1, 0).getDate()
    const to = `${year}-${pad(month + 1)}-${pad(last)}`
    try { setItems(await api(`/api/checkins?from=${from}&to=${to}`)) }
    catch (err) { setError(err.message) }
  }

  useEffect(() => { load() }, [year, month])

  const selectDay = (date) => {
    setSelected(date)
    const item = byDate[date]
    setStatus(item?.status || 'SUCCESS')
    setMemo(item?.memo || '')
  }

  const save = async () => {
    try {
      await api('/api/checkins', { method: 'POST', body: JSON.stringify({ date: selected, status, memo }) })
      await load()
    } catch (err) { setError(err.message) }
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
        {[['SUCCESS','성공'],['CRISIS','위기 있었음'],['FAILED','실패']].map(([value,label]) => <button key={value} className={status === value ? 'active' : ''} onClick={() => setStatus(value)}>{label}</button>)}
      </div>
      <textarea rows="3" maxLength="500" placeholder="오늘 어땠는지 간단히 기록" value={memo} onChange={(e) => setMemo(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button className="primary" onClick={save}>체크인 저장</button>
    </section>
  </div>
}

function StatisticsPage() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/api/statistics').then(setStats).catch((err) => setError(err.message))
  }, [])

  return <div className="stack gap-lg">
    <section className="section-heading"><p className="eyebrow">MY PATTERN</p><h1>누적 통계</h1></section>
    {error && <p className="error card">{error}</p>}
    {!stats ? <CenteredMessage text="통계를 계산하는 중..." inline /> : <>
      <div className="stats-grid">
        <StatCard label="현재 기록" value={`DAY ${stats.currentDay}`} />
        <StatCard label="최고 기록" value={`DAY ${stats.bestDay}`} />
        <StatCard label="위기 발생" value={`${stats.crisisCount}회`} />
        <StatCard label="도움됨" value={`${stats.helpfulClicks}회`} />
      </div>
      <section className="card">
        <p className="eyebrow">DANGER TIME</p>
        <h2>{stats.mostDangerousHour == null ? '아직 데이터 부족' : `${pad(stats.mostDangerousHour)}:00 ~ ${pad((stats.mostDangerousHour + 1) % 24)}:00`}</h2>
        <p className="muted">위기 버튼을 누른 기록을 기준으로 가장 빈도가 높은 시간대입니다.</p>
      </section>
      <section className="card stat-lines">
        <div><span>성공 체크인</span><strong>{stats.successCheckIns}</strong></div>
        <div><span>실패 체크인</span><strong>{stats.failedCheckIns}</strong></div>
      </section>
    </>}
  </div>
}

function StatCard({ label, value }) {
  return <section className="stat-card"><span>{label}</span><strong>{value}</strong></section>
}

function Modal({ children, onClose, crisis = false }) {
  return <div className={crisis ? 'modal-backdrop crisis-bg' : 'modal-backdrop'} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
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
