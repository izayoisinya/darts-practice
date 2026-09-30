const SETTINGS_KEY = "dartsSettings"

const DEFAULT_SETTINGS = {
  bullMode: "fat",
  orientationMode: "auto"
}

function readSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return { ...DEFAULT_SETTINGS, ...(parsed || {}) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function writeSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

function loadSettings() {
  const settings = readSettings()

  document.getElementById("bullModeSetting").value = settings.bullMode
  const orientationSelect = document.getElementById("orientationSetting")
  if (orientationSelect) {
    orientationSelect.value = settings.orientationMode
  }
}

function saveSettings() {
  const prevSettings = readSettings()

  const settings = {
    bullMode: document.getElementById("bullModeSetting").value,
    orientationMode: document.getElementById("orientationSetting")?.value || "auto"
  }

  writeSettings(settings)

  updateOrientationStatus("適用中...")
  applyOrientationMode(settings.orientationMode)

  const shouldResetGame = prevSettings.bullMode !== settings.bullMode
  if (shouldResetGame) {
    localStorage.removeItem("dartsPractice")
    alert("Bull設定を変更したため現在のゲームをリセットしました")
  }
}

function updateOrientationStatus(message) {
  const status = document.getElementById("orientationStatus")
  if (!status) return
  status.textContent = message
}

function applyOrientationMode(mode) {
  if (typeof window.applyOrientationPreference !== "function") {
    updateOrientationStatus("この端末では回転設定を制御できません")
    return
  }

  window.applyOrientationPreference(mode).then(success => {
    if (success) {
      if (mode === "auto") {
        updateOrientationStatus("回転モード: Free")
      } else if (mode === "portrait") {
        updateOrientationStatus("回転モード: Portrait Lock")
      } else {
        updateOrientationStatus("回転モード: Landscape Lock")
      }
      return
    }

    updateOrientationStatus("この端末/ブラウザでは回転ロックが適用されませんでした")
  })
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value < 0) return "-"
  const units = ["B", "KB", "MB", "GB"]
  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  const digits = unitIndex === 0 ? 0 : 1
  return `${size.toFixed(digits)} ${units[unitIndex]}`
}

function backendToLabel(backend) {
  if (backend === "indexedDB") return "IndexedDB"
  if (backend === "localStorage") return "localStorage"
  return "不明"
}

async function updateStorageStatus() {
  const gameCountEl = document.getElementById("storageGameCount")
  const backendEl = document.getElementById("storageBackend")
  const usageEl = document.getElementById("storageUsage")
  const quotaEl = document.getElementById("storageQuota")
  const noteEl = document.getElementById("storageStatusNote")

  if (!gameCountEl || !backendEl || !usageEl || !quotaEl) return

  if (typeof initSessionsStorage === "function") {
    await initSessionsStorage()
  }

  const sessions = typeof readSessions === "function" ? readSessions() : []
  gameCountEl.textContent = `${(Array.isArray(sessions) ? sessions.length : 0).toLocaleString()} 件`

  const backend = typeof getSessionsStorageBackend === "function"
    ? getSessionsStorageBackend()
    : "unknown"
  backendEl.textContent = backendToLabel(backend)

  if (navigator.storage && typeof navigator.storage.estimate === "function") {
    try {
      const estimate = await navigator.storage.estimate()
      usageEl.textContent = formatBytes(Number(estimate?.usage || 0))
      quotaEl.textContent = formatBytes(Number(estimate?.quota || 0))
      if (noteEl) {
        noteEl.textContent = "容量はブラウザ全体の概算です。実データのみの正確な容量ではありません。"
      }
      return
    } catch {
      // fall through
    }
  }

  usageEl.textContent = "取得不可"
  quotaEl.textContent = "取得不可"
  if (noteEl) {
    noteEl.textContent = "このブラウザでは容量見積もりAPIを利用できません。"
  }
}

// ===============================
// ===== バックアップ（書き出し・読み込み） =====
// ===============================
function setBackupStatus(message) {
  const el = document.getElementById("backupStatus")
  if (el) el.textContent = message
}

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

async function exportBackup() {
  if (typeof initSessionsStorage === "function") {
    await initSessionsStorage()
  }

  const data = createBackupData()
  const fileName = getBackupFileName()
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" })
  const doneMessage = `ゲーム ${data.sessions.length.toLocaleString()} 件と日別メモ ${Object.keys(data.dayNotes).length} 件を書き出しました`

  // タブレット・スマホは共有シート（「ファイルに保存」や AirDrop）を優先する
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
      setBackupStatus(doneMessage)
      return
    } catch (error) {
      if (error && error.name === "AbortError") {
        setBackupStatus("書き出しをキャンセルしました")
        return
      }
      // 共有できなかった場合はダウンロードに切り替える
    }
  }

  downloadBackupFile(blob, fileName)
  setBackupStatus(doneMessage)
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("ファイルを読み込めませんでした"))
    reader.readAsText(file)
  })
}

async function importBackupFile(file) {
  if (!file) return

  try {
    if (typeof initSessionsStorage === "function") {
      await initSessionsStorage()
    }

    const data = parseBackupText(await readFileAsText(file))
    const plan = planBackupImport(data)
    const newCount = plan.newSessions.length

    if (newCount === 0 && plan.updatedNoteCount === 0) {
      setBackupStatus("追加するデータはありませんでした（すべて取り込み済みです）")
      alert("追加するデータはありませんでした（すべて取り込み済みです）")
      return
    }

    const ok = confirm(
      `ファイル内のゲーム ${plan.totalSessions.toLocaleString()} 件のうち、` +
      `まだない ${newCount.toLocaleString()} 件を追加します。\n` +
      `日別メモは ${plan.updatedNoteCount} 件を追加・更新します。\n\n` +
      "今の記録は消えません。読み込みますか？"
    )
    if (!ok) {
      setBackupStatus("読み込みをキャンセルしました")
      return
    }

    await applyBackupImport(plan)

    setBackupStatus(`ゲーム ${newCount.toLocaleString()} 件と日別メモ ${plan.updatedNoteCount} 件を読み込みました`)
    await updateStorageStatus()
  } catch (error) {
    const message = error && error.message ? error.message : "読み込みに失敗しました"
    setBackupStatus(message)
    alert(message)
  }
}

function initBackupControls() {
  const exportBtn = document.getElementById("exportBackupBtn")
  const importBtn = document.getElementById("importBackupBtn")
  const importInput = document.getElementById("importBackupInput")

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      exportBackup().catch(() => setBackupStatus("書き出しに失敗しました"))
    })
  }

  if (importBtn && importInput) {
    importBtn.addEventListener("click", () => importInput.click())

    importInput.addEventListener("change", async () => {
      const file = importInput.files && importInput.files[0]
      await importBackupFile(file)
      // 同じファイルをもう一度選べるようにする
      importInput.value = ""
    })
  }
}

async function initSettingsPage() {
  const bullSelect = document.getElementById("bullModeSetting")
  const roundSelect = document.getElementById("roundSetting")
  const orientationSelect = document.getElementById("orientationSetting")
  const refreshStatusBtn = document.getElementById("refreshStorageStatusBtn")

  if (!bullSelect) return

  bullSelect.addEventListener("change", saveSettings)
  if (roundSelect) {
    roundSelect.addEventListener("change", saveSettings)
  }
  if (orientationSelect) {
    orientationSelect.addEventListener("change", saveSettings)
  }
  if (refreshStatusBtn) {
    refreshStatusBtn.addEventListener("click", () => {
      updateStorageStatus()
    })
  }

  initBackupControls()

  loadSettings()
  applyOrientationMode(readSettings().orientationMode)
  await updateStorageStatus()
}

initSettingsPage()