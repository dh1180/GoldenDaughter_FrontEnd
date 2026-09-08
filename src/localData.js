const STORAGE_KEY = 'gd_local_state_v1'
const MIGRATION_KEY = 'gd_server_migration_done_v1'

const defaultState = () => ({
  version: 1,
  profile: { nickname: '나' },
  currentStreak: null,
  streakHistory: [],
  checkins: {},
  bestDayFloor: 0,
  migratedAt: null,
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

export function hasLocalData() {
  return Boolean(localStorage.getItem(STORAGE_KEY))
}

export function migrationDone() {
  return localStorage.getItem(MIGRATION_KEY) === 'true'
}

export function markMigrationDone() {
  localStorage.setItem(MIGRATION_KEY, 'true')
}

export function importLegacyData({ me, streak, stats, checkins }) {
  const state = readLocalState()
  const nextCheckins = { ...state.checkins }

  for (const item of Array.isArray(checkins) ? checkins : []) {
    if (!item?.date) continue
    nextCheckins[item.date] = {
      date: item.date,
      status: item.status || 'SUCCESS',
      memo: item.memo || '',
    }
  }

  const next = {
    ...state,
    profile: { nickname: me?.nickname || state.profile.nickname || '나' },
    currentStreak: streak?.active && streak?.startedAt
      ? { startedAt: streak.startedAt }
      : state.currentStreak,
    checkins: nextCheckins,
    bestDayFloor: Math.max(state.bestDayFloor || 0, Number(stats?.bestDay || 0)),
    migratedAt: new Date().toISOString(),
  }

  writeLocalState(next)
  markMigrationDone()
  return next
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
  const now = new Date().toISOString()
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

export function importBackupJson(text) {
  const parsed = JSON.parse(text)
  const data = parsed?.data || parsed
  if (!data || typeof data !== 'object') throw new Error('올바른 GoldenDaughter 백업 파일이 아닙니다.')
  const next = {
    ...defaultState(),
    ...data,
    version: 1,
    profile: { ...defaultState().profile, ...(data.profile || {}) },
    streakHistory: Array.isArray(data.streakHistory) ? data.streakHistory : [],
    checkins: data.checkins && typeof data.checkins === 'object' ? data.checkins : {},
  }
  writeLocalState(next)
  return next
}
