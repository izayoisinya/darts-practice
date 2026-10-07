// ==========================
// CORE
// ==========================

const body = document.body


function detectDevice() {
  
  const w = window.innerWidth
  const h = window.innerHeight
  
  body.classList.remove(
    "phone",
    "tablet",
    "desktop",
    "portrait",
    "landscape"
  )
  
  const ua = navigator.userAgent
  
  const isIPad =
    ua.includes("iPad") ||
    (ua.includes("Macintosh") && "ontouchend" in document)
  
  const isIPhone = /iPhone/i.test(ua)
  const isAndroid = /Android/i.test(ua)
  
  if (isIPhone || (isAndroid && w < 1500)) {
    body.classList.add("phone")
  }
  else if (isIPad || (isAndroid && w >= 1500) || w < 1600) {
    body.classList.add("tablet")
  }
  else {
    body.classList.add("desktop")
  }
  
  if (h > w) {
    body.classList.add("portrait")
  } else {
    body.classList.add("landscape")
  }
  
}


// Android では、端末の「戻る」で前の画面に戻ったとき（ページがキャッシュから表示されたとき）などに、
// height: 100% の高さが古いまま残り、画面の下に空白ができることがある。
// 実際の画面の高さ（window.innerHeight）を html の高さに直接入れて合わせる。
// iOS は base.css の 100lvh の対応があるので触らない
const IS_ANDROID = /Android/i.test(navigator.userAgent)

function fitViewportHeight() {

  if (!IS_ANDROID) return

  const height = window.innerHeight
  if (height > 0) {
    document.documentElement.style.height = `${height}px`
  }
}

// 画面の大きさが落ち着くまで少し時間がかかることがあるので、何回か合わせ直す
function refitViewportHeightSoon() {

  if (!IS_ANDROID) return

  fitViewportHeight()
  ;[100, 400, 1000].forEach(delay => setTimeout(fitViewportHeight, delay))
}


function refreshLayout() {
  
  fitViewportHeight()
  detectDevice()
  
  if (typeof applyGamePanelVisibility === "function") {
    applyGamePanelVisibility()
  }
  
  if (typeof createNumberTable === "function") {
    createNumberTable()
  }
  
  if (typeof drawScoreChart === "function") {
    drawScoreChart()
  }
  
}


function setupLinks() {
  
  document.querySelectorAll("[data-link]").forEach(btn => {
    
    btn.addEventListener("click", () => {
      
      location.href = btn.dataset.link
      
    })
    
  })
  
}

