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

  loadSettings()
  applyOrientationMode(readSettings().orientationMode)
  await updateStorageStatus()
}

initSettingsPage()