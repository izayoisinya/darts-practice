// ===============================
// ===== バックアップ =============
// ===============================
// ゲームの記録と日別メモの書き出し・読み込み。
// 画面操作は含まない（ボタンなどの UI は ui/settings.js）。

const BACKUP_APP_ID = "darts-practice"
// 1：最初の形式
// 2：ゲームの記録に 1 投ごとの記録（darts）が加わった（1 の形式もそのまま読める）
const BACKUP_VERSION = 2
const BACKUP_DAY_NOTES_KEY = "dartsDayNotesV2"


// ===============================
// ===== 日別メモ =================
// ===============================
function readDayNotesForBackup() {

  try {
    const notes = JSON.parse(localStorage.getItem(BACKUP_DAY_NOTES_KEY) || "{}")

    // 旧形式（mode 別）は day だけ読む（data_grouped.js の getAllDayNotes() と同じ扱い）
    if (notes && notes.day && typeof notes.day === "object") {
      return notes.day
    }

    return notes && typeof notes === "object" ? notes : {}
  } catch {
    return {}
  }
}

// 読み込んだメモを、アプリが使う形だけに整える
function sanitizeDayNote(note) {

  if (!note || typeof note !== "object") return null

  const imageData = typeof note.imageData === "string" &&
    note.imageData.startsWith("data:image/")
    ? note.imageData
    : ""

  return {
    comment: typeof note.comment === "string" ? note.comment : "",
    tags: Array.isArray(note.tags)
      ? note.tags.filter(tag => typeof tag === "string")
      : [],
    imageData,
    updatedAt: Number(note.updatedAt) || 0
  }
}


// ===============================
// ===== 書き出し =================
// ===============================
function createBackupData() {

  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    sessions: readSessions().slice(),
    dayNotes: readDayNotesForBackup()
  }
}

function getBackupFileName(date = new Date()) {

  const pad = n => String(n).padStart(2, "0")

  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}`

  return `darts-practice-backup-${day}-${time}.json`
}


// ===============================
// ===== 読み込み =================
// ===============================
function parseBackupText(text) {

  let data

  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("ファイルの形式が正しくありません（JSON として読めません）")
  }

  if (!data || data.app !== BACKUP_APP_ID || !Array.isArray(data.sessions)) {
    throw new Error("Darts Practice のバックアップファイルではありません")
  }

  if (typeof data.version === "number" && data.version > BACKUP_VERSION) {
    throw new Error("新しいバージョンのアプリで書き出されたファイルです。アプリを更新してから読み込んでください")
  }

  return data
}

// 同じゲームかどうかの判定に使うキー（記録には ID がないため、種類・終了日時・スコアで判定）
function getSessionBackupKey(session) {
  return `${session.gameType}_${session.date}_${session.score}`
}

// 取り込み内容を見積もる（まだ保存はしない）
function planBackupImport(data) {

  const keys = new Set(readSessions().map(getSessionBackupKey))

  const incoming = data.sessions
    .map(normalizeSessionForApp)
    .filter(Boolean)

  const newSessions = []

  incoming.forEach(session => {
    const key = getSessionBackupKey(session)
    if (keys.has(key)) return

    keys.add(key)
    newSessions.push(session)
  })

  // 日別メモ：その日のメモがない、または読み込む方が新しい場合だけ入れ替える
  const currentNotes = readDayNotesForBackup()
  const mergedNotes = { ...currentNotes }
  let updatedNoteCount = 0

  const incomingNotes = data.dayNotes && typeof data.dayNotes === "object"
    ? data.dayNotes
    : {}

  Object.keys(incomingNotes).forEach(dayKey => {
    const note = sanitizeDayNote(incomingNotes[dayKey])
    if (!note) return

    const current = currentNotes[dayKey]
    const currentUpdatedAt = Number(current?.updatedAt) || 0

    if (!current || note.updatedAt > currentUpdatedAt) {
      mergedNotes[dayKey] = note
      updatedNoteCount++
    }
  })

  return {
    totalSessions: incoming.length,
    newSessions,
    mergedNotes,
    updatedNoteCount
  }
}

// 取り込む（今の記録は消さずに、ない分だけ追加する）
function applyBackupImport(plan) {

  if (plan.updatedNoteCount > 0) {
    try {
      localStorage.setItem(BACKUP_DAY_NOTES_KEY, JSON.stringify(plan.mergedNotes))
    } catch {
      throw new Error("日別メモを保存できませんでした（端末の保存容量が不足している可能性があります）")
    }
  }

  const merged = readSessions()
    .concat(plan.newSessions)
    .sort((a, b) => a.date - b.date)

  return writeSessions(merged)
}
