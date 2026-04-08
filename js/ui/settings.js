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

function initSettingsPage() {
  const bullSelect = document.getElementById("bullModeSetting")
  const roundSelect = document.getElementById("roundSetting")
  const orientationSelect = document.getElementById("orientationSetting")

  if (!bullSelect) return

  bullSelect.addEventListener("change", saveSettings)
  if (roundSelect) {
    roundSelect.addEventListener("change", saveSettings)
  }
  if (orientationSelect) {
    orientationSelect.addEventListener("change", saveSettings)
  }

  loadSettings()
  applyOrientationMode(readSettings().orientationMode)
}

initSettingsPage()