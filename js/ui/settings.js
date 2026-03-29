const SETTINGS_KEY = "dartsSettings"

function loadSettings() {
  
  const settings = JSON.parse(
    localStorage.getItem(SETTINGS_KEY)
  ) || {
    bullMode: "fat"
  }
  
  document.getElementById("bullModeSetting").value = settings.bullMode
  
}

function saveSettings() {
  
  const settings = {
    bullMode: document.getElementById("bullModeSetting").value
  }
  
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify(settings)
  )
  
  // ===== ゲームリセット =====
  
  localStorage.removeItem("dartsPractice")
  
  alert("設定を変更したため現在のゲームをリセットしました")
  
}

document
  .getElementById("bullModeSetting")
  .addEventListener("change", saveSettings)

loadSettings()

document
  .getElementById("bullModeSetting")
  .addEventListener("change", saveSettings)

document
  .getElementById("roundSetting")
  .addEventListener("change", saveSettings)

loadSettings()