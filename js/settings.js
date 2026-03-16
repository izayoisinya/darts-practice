const SETTINGS_KEY = "dartsSettings"

function loadSettings() {
  
  const settings = JSON.parse(
    localStorage.getItem(SETTINGS_KEY)
  ) || {
    bullMode: "fat",
    rounds: 8
  }
  
  document.getElementById("bullModeSetting").value = settings.bullMode
  document.getElementById("roundSetting").value = settings.rounds
  
}

function saveSettings() {
  
  const settings = {
    bullMode: document.getElementById("bullModeSetting").value,
    rounds: Number(document.getElementById("roundSetting").value)
  }
  
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify(settings)
  )
  
}

function resetData() {
  
  if (!confirm("すべてのデータを削除しますか？")) return
  
  localStorage.removeItem("dartsPractice")
  localStorage.removeItem("dartsSessions")
  
  alert("データを削除しました")
  
}

document
  .getElementById("bullModeSetting")
  .addEventListener("change", saveSettings)

document
  .getElementById("roundSetting")
  .addEventListener("change", saveSettings)

loadSettings()