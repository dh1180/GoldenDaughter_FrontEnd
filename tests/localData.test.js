import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  exportBackupJson,
  importBackupJson,
  parseBackupJson,
  readLocalState,
  resetLocalStreak,
  writeLocalState,
} from '../src/localData.js'

const storage = new Map()
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
}
globalThis.window = { dispatchEvent: () => {} }

beforeEach(() => storage.clear())

test('기록 초기화는 체크인과 최고 기록을 보존하고 지난 streak를 기록한다', () => {
  const originalNow = Date.now
  const now = Date.parse('2026-11-02T12:00:00.000Z')
  Date.now = () => now
  try {
    const startedAt = new Date(now - 5 * 86400000 - 3600000).toISOString()
    writeLocalState({
      version: 1,
      profile: { nickname: '나' },
      currentStreak: { startedAt },
      streakHistory: [],
      checkins: { '2026-11-01': { date: '2026-11-01', status: 'SUCCESS', memo: '메모' } },
      bestDayFloor: 10,
    })
    const after = resetLocalStreak()
    assert.equal(after.currentStreak.startedAt, new Date(now).toISOString())
    assert.equal(after.streakHistory.length, 1)
    assert.equal(after.streakHistory[0].day, 6)
    assert.equal(after.streakHistory[0].endedAt, new Date(now).toISOString())
    assert.deepEqual(after.checkins['2026-11-01'], { date: '2026-11-01', status: 'SUCCESS', memo: '메모' })
    assert.equal(after.bestDayFloor, 10)
  } finally {
    Date.now = originalNow
  }
})

test('유효하지 않은 백업은 기존 기록을 덮어쓰지 않는다', () => {
  const original = readLocalState()
  writeLocalState({ ...original, currentStreak: { startedAt: '2026-11-01T00:00:00Z' } })
  const previous = readLocalState()
  assert.throws(() => importBackupJson('{"foo":1}'), /올바른/)
  assert.deepEqual(readLocalState(), previous)
})

test('기존 백업 JSON을 정상 복원한다', () => {
  const previous = readLocalState()
  writeLocalState({ ...previous, currentStreak: { startedAt: '2026-11-01T00:00:00Z' } })
  const exported = exportBackupJson()
  const preview = parseBackupJson(exported)
  assert.equal(preview.currentStreak.startedAt, '2026-11-01T00:00:00Z')
  storage.clear()
  const restored = importBackupJson(exported)
  assert.equal(restored.currentStreak.startedAt, '2026-11-01T00:00:00Z')
  assert.deepEqual(readLocalState().checkins, {})
})
