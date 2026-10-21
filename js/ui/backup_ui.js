// ===============================
// ===== バックアップの保存とお知らせ =====
// ===============================
// ブラウザのアプリは、操作なしに端末のファイルへ保存できない。そこで、
//   ・メニュー画面で「そろそろバックアップしませんか」と声をかけ（前回から日付が変わって新しい記録があるとき）、ワンタップで保存する（共有シート → ファイルに保存 / ダウンロード）
//   ・最後にバックアップした日時とゲーム数を覚え、設定画面に出す
//   ・ブラウザに「このサイトのデータを自動で消さないで」と頼む（navigator.storage.persist()）
//   ・記録が 0 件のときは、バックアップから戻す方法を案内する
// 書き出すデータの中身は core/backup.js の createBackupData()。index.html と settings.html で読み込む

const BACKUP_INFO_KEY = "dartsBackupInfo"

// 声をかける頻度（設定画面の Backup Reminder。dartsSettings.backupReminder）
//   days：前回のバックアップから何日（日付で数える）経ったら。新しい記録があるときだけ声をかける。
//   1 日に何ゲームしても、声をかけるのは翌日以降（練習中に何度も出さない）
const BACKUP_REMINDER_RULES = {
  daily: { days: 1 },
  weekly: { days: 7 },
  off: null
}

// 前の版の値（10 ゲームか 7 日 / 30 ゲームか 30 日）は、近いものに読み替える
const BACKUP_REMINDER_OLD = { often: "daily", rarely: "weekly" }

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
    const mode = BACKUP_REMINDER_OLD[settings.backupReminder] || settings.backupReminder
    return BACKUP_REMINDER_RULES.hasOwnProperty(mode) ? mode : "daily"
  } catch {
    return "daily"
  }
}

// 2 つの日時が、日付で何日離れているか（時刻は見ない。昨日の 23 時と今日の 0 時でも 1 日）
function getCalendarDaysBetween(from, to) {
  const a = new Date(from)
  const b = new Date(to)
  const dayA = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  const dayB = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
  return Math.round((dayB - dayA) / (24 * 60 * 60 * 1000))
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
  if (getCalendarDaysBetween(since, now) < rule.days) return null

  // 「あとで」を押した日は、もう出さない（翌日にまた出す）
  const snoozedAt = Number(info.snoozeAt) || 0
  if (snoozedAt && getCalendarDaysBetween(snoozedAt, now) < 1) return null

  return { games, lastAt: Number(info.lastAt) || 0 }
}

function markBackupDone(count) {
  const info = readBackupInfo()
  writeBackupInfo({ ...info, lastAt: Date.now(), lastCount: count, snoozeAt: 0 })
}

function snoozeBackupReminder() {
  const info = readBackupInfo()
  writeBackupInfo({ ...info, snoozeAt: Date.now() })
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
