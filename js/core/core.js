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


function refreshLayout() {
  
  detectDevice()

  if (typeof applyGamePanelVisibility === "function") {
    applyGamePanelVisibility()
  }
  
  if (typeof createNumberTable === "function") {
    createNumberTable()
  }

  if (typeof renderRounds === "function") {
    renderRounds()
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

