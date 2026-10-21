// ===============================
// ===== バックアップの保存とお知らせ =====
// ===============================
// ブラウザのアプリは、操作なしに端末のファイルへ保存できない。そこで、
//   ・メニュー画面で「そろそろバックアップしませんか」と声をかけ、ワンタップで保存する（共有シート → ファイルに保存 / ダウンロード）
//   ・最後にバックアップした日時とゲーム数を覚え、設定画面に出す
//   ・ブラウザに「このサイトのデータを自動で消さないで」と頼む（navigator.storage.persist()）
//   ・記録が 0 件のときは、バックアップから戻す方法を案内する
// 書き出すデータの中身は core/backup.js の createBackupData()。index.html と settings.html で読み込む

const BACKUP_INFO_KEY = "dartsBackupInfo"

// 声をかける頻度（設定画面の Backup Reminder。dartsSettings.backupReminder）
//   games：前回から何ゲーム増えたら / days：前回から何日経ったら（新しい記録があるときだけ）
const BACKUP_REMINDER_RULES = {
  often: { games: 10, days: 7 },
  rarely: { games: 30, days: 30 },
  off: null
}

// 「あとで」を押したら、1 日経つか 5 ゲーム増えるまで出さない
const BACKUP_SNOOZE_MS = 24 * 60 * 60 * 1000
const BACKUP_SNOOZE_GAMES = 5

function readBackupInfo() {
  try {
    const info = JSON.parse(localStorage.getItem(BACKUP_INFO_KEY) || "{}")
    return info && typeof info === "object" ? info : {}
  } catch {
    return {}
  }
}

function writeBackupInfo(info) {
  try {
    localStorage.setItem(BACKUP_INFO_KEY, JSON.stringify(info))
  } catch {
    // 保存できなくても動きは止めない
  }
}

function getBackupReminderMode() {
  try {
    const settings = JSON.parse(localStorage.getItem("dartsSettings") || "{}") || {}
    return BACKUP_REMINDER_RULES.hasOwnProperty(settings.backupReminder) ? settings.backupReminder : "often"
  } catch {
    return "often"
  }
}

function getSavedGameCount() {
  return typeof readSessions === "function" ? readSessions().length : 0
}

// 声をかけるか（{ games：前回から増えたゲーム数, lastAt } か null）
function getBackupReminder(now = Date.now()) {

  const rule = BACKUP_REMINDER_RULES[getBackupReminderMode()]
  if (!rule) return null

  const count = getSavedGameCount()
  const info = readBackupInfo()
  const lastCount = Number(info.lastCount) || 0
  const games = count - lastCount
  // 読み込みなどで前回より少なくなっていたら、今の数を基準にし直す
  if (games <= 0) return null

  // 一度もバックアップしていないときは、いちばん古い記録の日から数える
  let since = Number(info.lastAt) || 0
  if (!since) {
    const sessions = typeof readSessions === "function" ? readSessions() : []
    since = sessions.length ? Number(sessions[0].date) || now : now
  }
  const days = (now - since) / (24 * 60 * 60 * 1000)

  if (games < rule.games && days < rule.days) return null

  const snoozedAt = Number(info.snoozeAt) || 0
  if (snoozedAt && now - snoozedAt < BACKUP_SNOOZE_MS && count - (Number(info.snoozeCount) || 0) < BACKUP_SNOOZE_GAMES) {
    return null
  }

  return { games, lastAt: Number(info.lastAt) || 0 }
}

function markBackupDone(count) {
  const info = readBackupInfo()
  writeBackupInfo({ ...info, lastAt: Date.now(), lastCount: count, snoozeAt: 0, snoozeCount: 0 })
}

function snoozeBackupReminder() {
  const info = readBackupInfo()
  writeBackupInfo({ ...info, snoozeAt: Date.now(), snoozeCount: getSavedGameCount() })
}

function formatBackupDate(time) {
  const d = new Date(time)
  const pad = n => String(n).padStart(2, "0")
  const year = d.getFullYear() === new Date().getFullYear() ? "" : `${d.getFullYear()}/`
  return `${year}${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 最後にバックアップした日時（設定画面に出す）
function getBackupLastText() {
  const info = readBackupInfo()
  if (!info.lastAt) return "まだバックアップしていません"
  return `最終バックアップ：${formatBackupDate(info.lastAt)}（${(Number(info.lastCount) || 0).toLocaleString()} ゲーム）`
}


// ===============================
// ===== ファイルに保存 =============
// ===============================
function downloadBackupFile(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// バックアップのファイルを保存する。タブレット・スマホは共有シート（「ファイルに保存」など）を優先し、
// 使えないときはダウンロードにする。結果：{ status: "done" | "cancelled", sessions, notes }
async function saveBackupFile() {

  if (typeof initSessionsStorage === "function") {
    await initSessionsStorage()
  }

  const data = createBackupData()
  const fileName = getBackupFileName()
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" })
  const result = { status: "done", sessions: data.sessions.length, notes: Object.keys(data.dayNotes).length }

  const canShareFile =
    !document.body.classList.contains("desktop") &&
    typeof File === "function" &&
    navigator.canShare &&
    navigator.canShare({ files: [new File([blob], fileName, { type: "application/json" })] })

  if (canShareFile) {
    try {
      await navigator.share({
        files: [new File([blob], fileName, { type: "application/json" })],
        title: fileName
      })
      markBackupDone(data.sessions.length)
      return result
    } catch (error) {
      if (error && error.name === "AbortError") return { ...result, status: "cancelled" }
      // 共有できなかった場合はダウンロードに切り替える
    }
  }

  downloadBackupFile(blob, fileName)
  markBackupDone(data.sessions.length)
  return result
}


// ===============================
// ===== 自動削除からの保護 =========
// ===============================
// 容量が足りないときなどにブラウザが自動でデータを消さないよう頼む（自分で「データを消す」と消える）。
// 結果は設定画面に出す：true（保護されている）/ false / null（このブラウザでは使えない）
async function requestPersistentStorage() {
  if (!navigator.storage || typeof navigator.storage.persist !== "function") return null
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}


// ===============================
// ===== メニュー画面のお知らせ =====
// ===============================
function renderBackupReminder() {

  const box = document.getElementById("backupReminder")
  if (!box) return

  const count = getSavedGameCount()

  // 記録が 0 件：バックアップから戻す方法を案内する（データを消してしまったときのため）
  if (count === 0) {
    box.className = "backup-reminder empty"
    box.innerHTML = `
      <div class="backup-reminder-text">
        <strong>記録はまだありません</strong>
        <span>以前のバックアップファイルがあれば、設定の「読み込み」から記録を戻せます。</span>
      </div>
      <div class="backup-reminder-actions">
        <button type="button" data-backup-open>読み込みへ</button>
      </div>
    `
    box.hidden = false
    return
  }

  const reminder = getBackupReminder()
  if (!reminder) {
    box.hidden = true
    box.innerHTML = ""
    return
  }

  box.className = "backup-reminder"
  box.innerHTML = `
    <div class="backup-reminder-text">
      <strong>${reminder.lastAt ? `前回のバックアップから ${reminder.games.toLocaleString()} ゲーム増えました` : `記録が ${count.toLocaleString()} ゲームたまりました`}</strong>
      <span>${reminder.lastAt ? `最終バックアップ：${formatBackupDate(reminder.lastAt)}。` : "まだ一度もバックアップしていません。"}ブラウザのデータを消すと記録も消えるので、ファイルに保存しておきましょう。</span>
    </div>
    <div class="backup-reminder-actions">
      <button type="button" class="primary" data-backup-save>今すぐ保存</button>
      <button type="button" data-backup-later>あとで</button>
    </div>
  `
  box.hidden = false
}

function initBackupReminder() {

  const box = document.getElementById("backupReminder")
  if (!box || box.dataset.ready) return
  box.dataset.ready = "1"

  box.addEventListener("click", async e => {
    const target = e.target instanceof Element ? e.target : null
    if (!target) return

    if (target.closest("[data-backup-open]")) {
      location.href = "settings.html#backup"
      return
    }

    if (target.closest("[data-backup-later]")) {
      snoozeBackupReminder()
      renderBackupReminder()
      return
    }

    if (target.closest("[data-backup-save]")) {
      try {
        const result = await saveBackupFile()
        if (result.status === "cancelled") return
        box.className = "backup-reminder done"
        box.innerHTML = `<div class="backup-reminder-text"><strong>保存しました</strong><span>ゲーム ${result.sessions.toLocaleString()} 件と日別メモ ${result.notes} 件をファイルにしました。</span></div>`
        setTimeout(renderBackupReminder, 2500)
      } catch {
        box.querySelector(".backup-reminder-text span").textContent = "保存に失敗しました。設定画面の「書き出し」からも保存できます。"
      }
    }
  })

  renderBackupReminder()
}
