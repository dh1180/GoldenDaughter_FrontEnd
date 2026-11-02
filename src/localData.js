const STORAGE_KEY = 'gd_local_state_v1'

const defaultState = () => ({
  version: 1,
  profile: { nickname: '나' },
  currentStreak: null,
  streakHistory: [],
  checkins: {},
  bestDayFloor: 0,
})

export function readLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw)
    return {
      ...defaultState(),
      ...parsed,
      profile: { ...defaultState().profile, ...(parsed.profile || {}) },
      streakHistory: Array.isArray(parsed.streakHistory) ? parsed.streakHistory : [],
      checkins: parsed.checkins && typeof parsed.checkins === 'object' ? parsed.checkins : {},
    }
  } catch {
    return defaultState()
  }
}

export function writeLocalState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: 1 }))
  window.dispatchEvent(new Event('gd-local-data-changed'))
  return state
}

export function startLocalStreak(startedAt) {
  const state = readLocalState()
  return writeLocalState({
    ...state,
    currentStreak: { startedAt },
  })
}

export function resetLocalStreak() {
  const state = readLocalState()
  const now = new Date(Date.now()).toISOString()
  const history = [...state.streakHistory]
  let bestDayFloor = state.bestDayFloor || 0

  if (state.currentStreak?.startedAt) {
    const elapsed = Math.max(0, Math.floor((Date.now() - new Date(state.currentStreak.startedAt).getTime()) / 1000))
    const day = Math.floor(elapsed / 86400) + 1
    bestDayFloor = Math.max(bestDayFloor, day)
    history.push({
      startedAt: state.currentStreak.startedAt,
      endedAt: now,
      day,
    })
  }

  return writeLocalState({
    ...state,
    currentStreak: { startedAt: now },
    streakHistory: history,
    bestDayFloor,
  })
}

export function saveLocalCheckin(date, status, memo) {
  const state = readLocalState()
  return writeLocalState({
    ...state,
    checkins: {
      ...state.checkins,
      [date]: { date, status, memo: memo || '' },
    },
  })
}

export function localStatistics() {
  const state = readLocalState()
  let currentDay = 0
  if (state.currentStreak?.startedAt) {
    const elapsed = Math.max(0, Math.floor((Date.now() - new Date(state.currentStreak.startedAt).getTime()) / 1000))
    currentDay = Math.floor(elapsed / 86400) + 1
  }

  const historyBest = state.streakHistory.reduce((best, item) => Math.max(best, Number(item?.day || 0)), 0)
  const values = Object.values(state.checkins)

  return {
    currentDay,
    bestDay: Math.max(state.bestDayFloor || 0, historyBest, currentDay),
    successCheckIns: values.filter((item) => item.status === 'SUCCESS').length,
    failedCheckIns: values.filter((item) => item.status === 'FAILED').length,
    crisisCheckIns: values.filter((item) => item.status === 'CRISIS').length,
  }
}

export function exportBackupJson() {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    app: 'GoldenDaughter',
    data: readLocalState(),
  }, null, 2)
}

export function parseBackupJson(text) {
  const parsed = JSON.parse(text)
  if (parsed?.app && parsed.app !== 'GoldenDaughter') {
    throw new Error('GoldenDaughter 백업 파일이 아닙니다.')
  }
  const data = parsed?.data ?? parsed
  if (!data || typeof data !== 'object' || Array.isArray(data)
      || !('currentStreak' in data) || !('checkins' in data)) {
    throw new Error('올바른 GoldenDaughter 백업 파일이 아닙니다.')
  }
  if (data.currentStreak != null
      && (!data.currentStreak.startedAt || Number.isNaN(Date.parse(data.currentStreak.startedAt)))) {
    throw new Error('백업 파일의 시작 시각이 올바르지 않습니다.')
  }
  if (!data.checkins || typeof data.checkins !== 'object' || Array.isArray(data.checkins)
      || (data.streakHistory != null && !Array.isArray(data.streakHistory))) {
    throw new Error('백업 파일의 기록 형식이 올바르지 않습니다.')
  }
  return {
    ...defaultState(),
    ...data,
    version: 1,
    profile: { ...defaultState().profile, ...(data.profile || {}) },
    streakHistory: Array.isArray(data.streakHistory) ? data.streakHistory : [],
    checkins: data.checkins,
  }
}

export function importBackupJson(text) {
  const next = parseBackupJson(text)
  writeLocalState(next)
  return next
}
