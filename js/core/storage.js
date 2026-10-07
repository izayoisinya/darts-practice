// 進行中のゲーム（カウントアップと 01 は別々に持つ）
const SAVE_KEY = typeof GAME_TYPE !== "undefined" && GAME_TYPE === "01" ? "dartsPractice01" : "dartsPractice"
const SESSIONS_KEY = "dartsSessionsV2"
const LEGACY_SESSIONS_KEY = "dartsSessions"
const SESSION_DB_NAME = "dartsPracticeDB"
const SESSION_DB_VERSION = 1
const SESSION_STORE_NAME = "app"
const SESSION_RECORD_KEY = "sessions"
const AWARD_KEYS = [
  "hatTrick",
  "lowTon",
  "highTon",
  "ton80",
  "threeInTheBlack",
  "threeInTheBed",
  "whiteHorse"
]

let sessionsCache = null
let sessionsInitPromise = null
let sessionsWriteQueue = Promise.resolve()
let sessionsBackend = "localStorage"

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function toRoundScores(rounds) {
  if (!Array.isArray(rounds)) return []
  return rounds.map(round =>
    (round || []).reduce((sum, dart) => sum + (dart?.score || 0), 0)
  )
}

function toTripleArray(tripleHits) {
  const list = []
  for (let i = 15; i <= 20; i++) {
    list.push(toFiniteNumber(tripleHits?.[i], 0))
  }
  return list
}

function fromTripleArray(data) {
  const tripleHits = {}
  if (Array.isArray(data)) {
    for (let i = 15; i <= 20; i++) {
      tripleHits[i] = toFiniteNumber(data[i - 15], 0)
    }
    return tripleHits
  }

  for (let i = 15; i <= 20; i++) {
    tripleHits[i] = toFiniteNumber(data?.[i], 0)
  }
  return tripleHits
}

function toAwardsArray(awards) {
  return AWARD_KEYS.map(key => toFiniteNumber(awards?.[key], 0))
}

function fromAwardsArray(data) {
  const awards = {}
  AWARD_KEYS.forEach((key, idx) => {
    awards[key] = Array.isArray(data)
      ? toFiniteNumber(data[idx], 0)
      : toFiniteNumber(data?.[key], 0)
  })
  return awards
}

// ===== 1 投ごとの記録（darts）=====
// アプリ内：{ hit: "T20" | "D5" | "S1" | "OB" | "IB" | "MISS", score, pos: { x, y } | null }
//   pos はボード入力のときだけ。本物のボードの比率での位置（中心が原点、ダブルの外側 = 1、y は下向きが正）
// 保存時：[hit, score] または [hit, score, x, y] の配列（未入力は 0）
// 並びは 1 ラウンド目の 1 投目から順（i 番目は (i / 3 の整数部分 + 1) ラウンド目）
const DART_HIT_PATTERN = /^(?:[SDT](?:[1-9]|1[0-9]|20)|OB|IB|MISS)$/

function toDartHitCode(dart) {
  if (!dart) return null
  if (dart.special === "innerBull") return "IB"
  if (dart.special === "outerBull") return "OB"
  if (!dart.score) return "MISS"

  const prefix = dart.multiplier === 3 ? "T" : dart.multiplier === 2 ? "D" : "S"
  return `${prefix}${dart.value}`
}

// 進行中のゲームの 1 投から、履歴に残す形を作る
function toDartRecord(dart) {
  const hit = toDartHitCode(dart)
  if (!hit) return null

  const x = Number(dart.pos?.x)
  const y = Number(dart.pos?.y)

  return {
    hit,
    score: toFiniteNumber(dart.score, 0),
    pos: Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
  }
}

// 保存形式（配列）とアプリ内の形（オブジェクト）のどちらからでも、アプリ内の形にそろえる。
// 読めない 1 投は null にして、並び（何ラウンド目の何投目か）は崩さない
function normalizeDartRecord(entry) {
  if (!entry) return null

  const source = Array.isArray(entry)
    ? { hit: entry[0], score: entry[1], pos: entry.length >= 4 ? { x: entry[2], y: entry[3] } : null }
    : entry

  const hit = String(source.hit || "")
  if (!DART_HIT_PATTERN.test(hit)) return null

  const x = Number(source.pos?.x)
  const y = Number(source.pos?.y)

  return {
    hit,
    score: toFiniteNumber(source.score, 0),
    pos: source.pos && Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
  }
}

function normalizeDartRecords(list) {
  return Array.isArray(list) ? list.map(normalizeDartRecord) : []
}

function serializeDartRecords(darts) {
  return darts.map(dart => {
    if (!dart) return 0
    return dart.pos
      ? [dart.hit, dart.score, dart.pos.x, dart.pos.y]
      : [dart.hit, dart.score]
  })
}

// 01 のゲームの結果（カウントアップは null）
//   アプリ内：{ start, out, rounds, finished, finishDarts, remaining }
//   保存時：[start, 上がり方（0 open / 1 double / 2 master）, rounds, 上がったか（1/0）, finishDarts, remaining]
const ZERO_ONE_OUT_CODES = ["open", "double", "master"]

function normalizeZeroOneRecord(value) {
  if (!value || typeof value !== "object") return null

  const source = Array.isArray(value)
    ? {
        start: value[0],
        out: ZERO_ONE_OUT_CODES[value[1]],
        rounds: value[2],
        finished: value[3] === 1,
        finishDarts: value[4],
        remaining: value[5]
      }
    : value

  return {
    start: toFiniteNumber(source.start, 501),
    out: ZERO_ONE_OUT_CODES.includes(source.out) ? source.out : "double",
    rounds: toFiniteNumber(source.rounds, 15),
    finished: source.finished === true,
    finishDarts: toFiniteNumber(source.finishDarts, 0),
    remaining: toFiniteNumber(source.remaining, 0)
  }
}

function serializeZeroOneRecord(record) {
  return [
    record.start,
    Math.max(0, ZERO_ONE_OUT_CODES.indexOf(record.out)),
    record.rounds,
    record.finished ? 1 : 0,
    record.finishDarts,
    record.remaining
  ]
}

function normalizeSessionForApp(session) {
  if (!session || typeof session !== "object") return null

  const roundScores = Array.isArray(session.roundScores)
    ? session.roundScores.map(score => toFiniteNumber(score, 0))
    : toRoundScores(session.rounds)

  const awards = fromAwardsArray(session.awards)

  return {
    date: toFiniteNumber(session.date, Date.now()),
    score: toFiniteNumber(session.score, 0),
    ppd: toFiniteNumber(session.ppd, 0),
    bulls: toFiniteNumber(session.bulls, 0),
    innerBulls: toFiniteNumber(session.innerBulls, 0),
    bullRate: toFiniteNumber(session.bullRate, 0),
    innerRate: toFiniteNumber(session.innerRate, 0),
    roundAvg: toFiniteNumber(session.roundAvg, 0),
    tripleHits: fromTripleArray(session.tripleHits),
    awards,
    totalAwards: toFiniteNumber(
      session.totalAwards,
      Object.values(awards).reduce((sum, count) => sum + count, 0)
    ),
    roundScores,
    // 1 投ごとの記録（2026.10.7 から。それより前の記録は空）
    darts: normalizeDartRecords(session.darts),
    gameType: String(session.gameType || "countup"),
    zeroOne: normalizeZeroOneRecord(session.zeroOne)
  }
}

function serializeSessionForStorage(session) {
  const normalized = normalizeSessionForApp(session)
  if (!normalized) return null

  return {
    d: normalized.date,
    s: normalized.score,
    p: normalized.ppd,
    b: normalized.bulls,
    i: normalized.innerBulls,
    br: normalized.bullRate,
    ir: normalized.innerRate,
    ra: normalized.roundAvg,
    t: toTripleArray(normalized.tripleHits),
    a: toAwardsArray(normalized.awards),
    ta: normalized.totalAwards,
    r: normalized.roundScores,
    g: normalized.gameType,
    ...(normalized.darts.length ? { dt: serializeDartRecords(normalized.darts) } : {}),
    ...(normalized.zeroOne ? { z: serializeZeroOneRecord(normalized.zeroOne) } : {})
  }
}

function deserializeSessionFromStorage(session) {
  if (!session || typeof session !== "object") return null

  return normalizeSessionForApp({
    date: session.d,
    score: session.s,
    ppd: session.p,
    bulls: session.b,
    innerBulls: session.i,
    bullRate: session.br,
    innerRate: session.ir,
    roundAvg: session.ra,
    tripleHits: session.t,
    awards: session.a,
    totalAwards: session.ta,
    roundScores: session.r,
    darts: session.dt,
    gameType: session.g,
    zeroOne: session.z
  })
}

function supportsIndexedDb() {
  return typeof indexedDB !== "undefined"
}

function openSessionDb() {
  return new Promise((resolve, reject) => {
    if (!supportsIndexedDb()) {
      reject(new Error("IndexedDB is not supported"))
      return
    }

    const request = indexedDB.open(SESSION_DB_NAME, SESSION_DB_VERSION)

    request.onupgradeneeded = event => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(SESSION_STORE_NAME)) {
        db.createObjectStore(SESSION_STORE_NAME, { keyPath: "id" })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"))
  })
}

function readCompactSessionsFromDb() {
  return openSessionDb().then(db =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE_NAME, "readonly")
      const store = tx.objectStore(SESSION_STORE_NAME)
      const request = store.get(SESSION_RECORD_KEY)

      request.onsuccess = () => {
        const value = request.result?.data
        resolve(Array.isArray(value) ? value : [])
      }
      request.onerror = () => reject(request.error || new Error("Failed to read sessions from IndexedDB"))

      tx.oncomplete = () => db.close()
      tx.onabort = () => db.close()
      tx.onerror = () => db.close()
    })
  )
}

function writeCompactSessionsToDb(compactSessions) {
  return openSessionDb().then(db =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE_NAME, "readwrite")
      const store = tx.objectStore(SESSION_STORE_NAME)
      store.put({
        id: SESSION_RECORD_KEY,
        data: compactSessions,
        updatedAt: Date.now()
      })

      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        const err = tx.error || new Error("Failed to write sessions to IndexedDB")
        db.close()
        reject(err)
      }
      tx.onabort = () => {
        const err = tx.error || new Error("IndexedDB write transaction aborted")
        db.close()
        reject(err)
      }
    })
  )
}

function clearSessionsFromDb() {
  if (!supportsIndexedDb()) return Promise.resolve()

  return openSessionDb().then(db =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE_NAME, "readwrite")
      const store = tx.objectStore(SESSION_STORE_NAME)
      store.delete(SESSION_RECORD_KEY)

      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        const err = tx.error || new Error("Failed to clear sessions from IndexedDB")
        db.close()
        reject(err)
      }
      tx.onabort = () => {
        const err = tx.error || new Error("IndexedDB clear transaction aborted")
        db.close()
        reject(err)
      }
    })
  )
}

function readSessionsFromLocalStorage() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
          .map(deserializeSessionFromStorage)
          .filter(Boolean)
      }
    }
  } catch {
    // ignore and fallback
  }

  try {
    const legacyRaw = localStorage.getItem(LEGACY_SESSIONS_KEY)
    if (!legacyRaw) return []

    const parsed = JSON.parse(legacyRaw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .map(normalizeSessionForApp)
      .filter(Boolean)
  } catch {
    return []
  }
}

function clearLocalSessionKeys() {
  localStorage.removeItem(SESSIONS_KEY)
  localStorage.removeItem(LEGACY_SESSIONS_KEY)
}

function queuePersistSessions(compact) {
  sessionsWriteQueue = sessionsWriteQueue
    .then(() => {
      if (supportsIndexedDb()) {
        return writeCompactSessionsToDb(compact)
          .then(() => {
            sessionsBackend = "indexedDB"
            clearLocalSessionKeys()
          })
      }

      sessionsBackend = "localStorage"
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(compact))
      localStorage.removeItem(LEGACY_SESSIONS_KEY)
      return undefined
    })
    .catch(() => {
      // IndexedDB write failure fallback.
      sessionsBackend = "localStorage"
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(compact))
      localStorage.removeItem(LEGACY_SESSIONS_KEY)
    })

  return sessionsWriteQueue
}

function initSessionsStorage() {
  if (sessionsInitPromise) return sessionsInitPromise

  sessionsInitPromise = (async () => {
    const local = readSessionsFromLocalStorage()
    sessionsCache = local

    if (!supportsIndexedDb()) {
      sessionsBackend = "localStorage"
      return sessionsCache
    }

    sessionsBackend = "indexedDB"

    try {
      const compactFromDb = await readCompactSessionsFromDb()

      if (Array.isArray(compactFromDb) && compactFromDb.length > 0) {
        sessionsCache = compactFromDb
          .map(deserializeSessionFromStorage)
          .filter(Boolean)
        sessionsBackend = "indexedDB"
        clearLocalSessionKeys()
        return sessionsCache
      }

      if (local.length > 0) {
        const compactLocal = local
          .map(serializeSessionForStorage)
          .filter(Boolean)
        await writeCompactSessionsToDb(compactLocal)
        sessionsBackend = "indexedDB"
        clearLocalSessionKeys()
      }
    } catch {
      // Keep localStorage fallback when IndexedDB init fails.
      sessionsBackend = "localStorage"
    }

    return sessionsCache
  })()

  return sessionsInitPromise
}

function writeSessions(sessions) {
  const list = Array.isArray(sessions) ? sessions : []
  const normalized = list
    .map(normalizeSessionForApp)
    .filter(Boolean)
  const compact = normalized
    .map(serializeSessionForStorage)
    .filter(Boolean)

  sessionsCache = normalized
  return queuePersistSessions(compact)
}

function readSessions() {
  if (!Array.isArray(sessionsCache)) {
    sessionsCache = readSessionsFromLocalStorage()
  }

  return sessionsCache
}

function clearSessionsStorage() {
  sessionsCache = []
  sessionsBackend = supportsIndexedDb() ? "indexedDB" : "localStorage"
  clearLocalSessionKeys()
  clearSessionsFromDb().catch(() => {})
}

function getSessionsStorageBackend() {
  return sessionsBackend
}

function saveGame() {
  
  const data = {
    gameType: GAME_TYPE,
    ...(GAME_TYPE === "01" ? { zeroOne: zeroOneConfig } : {}),
    rounds: game.rounds,
    currentRound: game.currentRound,
    currentDart: game.currentDart,
    lockedRound: lockedRound
  }
  
  localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  
}


function loadGame() {
  
  const data = localStorage.getItem(SAVE_KEY)
  if (!data) return false
  
  const saved = JSON.parse(data)

  if (GAME_TYPE === "01" && typeof normalizeZeroOneConfig === "function") {
    zeroOneConfig = normalizeZeroOneConfig(saved.zeroOne)
    TOTAL_ROUNDS = zeroOneConfig.rounds
  }
  
  game.rounds = saved.rounds
  game.currentRound = saved.currentRound
  game.currentDart = saved.currentDart
  lockedRound = saved.lockedRound ?? -1
  
  return true
}


function saveSession() {
  
  const sessions = readSessions()

  const calculated = typeof calculateStats === "function" ?
    calculateStats() :
    null
  
  const darts = game.rounds.flat().filter(d => d)
  
  const totalScore = calculated ?
    calculated.totalScore :
    darts.reduce((sum, d) => sum + d.score, 0)
  const totalDarts = darts.length
  
  const ppd = calculated ?
    calculated.ppd :
    (totalDarts ? (totalScore / totalDarts) : 0)
  
  // ===== Bulls =====
  const bulls = calculated ?
    calculated.bullCount :
    darts.filter(d =>
      d.special === "innerBull" || d.special === "outerBull"
    ).length
  
  const innerBulls = calculated ?
    calculated.innerBullCount :
    darts.filter(d =>
      d.special === "innerBull"
    ).length
  
  // ===== Triple =====
  const tripleHits = {}
  for (let i = 15; i <= 20; i++) {
    tripleHits[i] = darts.filter(d =>
      d.value === i && d.multiplier === 3
    ).length
  }
  
  // ===== Round Avg =====（01 はバストのラウンドを 0 点にした、実際に減らした点）
  const roundScores = typeof getRoundScoreList === "function"
    ? getRoundScoreList().map(round => round.score)
    : game.rounds.map(round =>
      round.reduce((sum, d) => sum + (d?.score || 0), 0)
    )
  
  const validRounds = roundScores.filter(s => s > 0)
  
  const roundAvg = calculated ?
    calculated.roundAvg :
    (validRounds.length ?
      validRounds.reduce((a, b) => a + b, 0) / validRounds.length :
      0)
  
  // ===== Bull Rate =====
  const bullRate = calculated ?
    calculated.bullRate :
    (totalDarts ?
      (bulls / totalDarts) * 100 :
      0)
    
  // ===== Inner Rate =====
  const innerRate = calculated ?
    calculated.innerBullRate :
    (totalDarts ?
      (innerBulls / totalDarts) * 100 :
      0)

  const awards = {
    hatTrick: calculated?.hatTrick ?? 0,
    lowTon: calculated?.lowTon ?? 0,
    highTon: calculated?.highTon ?? 0,
    ton80: calculated?.ton80 ?? 0,
    threeInTheBlack: calculated?.threeInTheBlack ?? 0,
    threeInTheBed: calculated?.threeInTheBed ?? 0,
    whiteHorse: calculated?.whiteHorse ?? 0
  }

  const totalAwards = Object.values(awards)
    .reduce((sum, count) => sum + count, 0)
  
  sessions.push({
  date: Date.now(),
  score: totalScore,
  ppd: Number(ppd.toFixed(2)),
  
  bulls,
  innerBulls,
  
  bullRate: Number(bullRate.toFixed(1)),
  innerRate: Number(innerRate.toFixed(1)), // ←追加
  
  roundAvg: Number(roundAvg.toFixed(1)),
  
  tripleHits,

  awards,
  totalAwards,

  roundScores,

  // 1 投ごとの記録（刺さった場所。ボード入力なら位置も）
  darts: game.rounds.flat().map(toDartRecord),

  gameType: GAME_TYPE,
  ...(GAME_TYPE === "01" && typeof computeZeroOne === "function" ? { zeroOne: getZeroOneResult() } : {})
  })
  
  writeSessions(sessions)
}