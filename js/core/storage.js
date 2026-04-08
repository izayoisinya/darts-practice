const SAVE_KEY = "dartsPractice"
const SESSIONS_KEY = "dartsSessionsV2"
const LEGACY_SESSIONS_KEY = "dartsSessions"
const AWARD_KEYS = [
  "hatTrick",
  "lowTon",
  "highTon",
  "ton80",
  "threeInTheBlack",
  "threeInTheBed",
  "whiteHorse"
]

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
    gameType: String(session.gameType || "countup")
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
    g: normalized.gameType
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
    gameType: session.g
  })
}

function writeSessions(sessions) {
  const list = Array.isArray(sessions) ? sessions : []
  const compact = list
    .map(serializeSessionForStorage)
    .filter(Boolean)

  localStorage.setItem(SESSIONS_KEY, JSON.stringify(compact))
  localStorage.removeItem(LEGACY_SESSIONS_KEY)
}

function readSessions() {
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

    const normalized = parsed
      .map(normalizeSessionForApp)
      .filter(Boolean)

    if (normalized.length) {
      writeSessions(normalized)
    }

    return normalized
  } catch {
    return []
  }
}

function clearSessionsStorage() {
  localStorage.removeItem(SESSIONS_KEY)
  localStorage.removeItem(LEGACY_SESSIONS_KEY)
}

function saveGame() {
  
  const data = {
    gameType: "countup",
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
  
  // ===== Round Avg =====
  const roundScores = game.rounds.map(round =>
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

  roundScores
  })
  
  writeSessions(sessions)
}