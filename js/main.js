// ===============================
// ===== 初期化 ==================
// ===============================
document.addEventListener("DOMContentLoaded", initApp)

function initApp() {
  
  detectDevice()
  refreshLayout()
  
  if (document.getElementById("roundContainer")) {
    initGame()
  }
  
  registerEvents()
  
  window.addEventListener("resize", refreshLayout)
  window.addEventListener("orientationchange", refreshLayout)
  
}


// ===============================
// ===== イベント登録 ============
// ===============================
function registerEvents() {
  
  const overlay = document.getElementById("menuOverlay")
  const edge = document.getElementById("menuEdge")
  const menu = document.getElementById("sideMenu")
  const statsArea = document.querySelector(".stats-area")
  
  const nextBtn = document.getElementById("nextGameBtn")
  if (nextBtn) {
    nextBtn.addEventListener("click", resetGame)
  }

if (edge && menu) {
  edge.addEventListener("click", () => {
    menu.classList.add("open")
    body.classList.add("menu-open")
  })
}
  
  const roundArea = document.querySelector(".round-area")

if (roundArea) {
  roundArea.addEventListener("click", () => {
    
    if (
  body.classList.contains("phone") &&
  body.classList.contains("portrait")
) {
      body.classList.toggle("round-open")
    }
    
  })
}

if (statsArea) {
  statsArea.addEventListener("click", () => {
    
    if (
      body.classList.contains("phone") &&
      body.classList.contains("landscape")
    ) {
      body.classList.toggle("iphone-stats-open")
    }
    
  })
}
  
  
  // ===== side menu =====
  
if (menu) {
  menu.querySelectorAll("button").forEach(btn => {
    
    btn.addEventListener("click", () => {
      menu.classList.remove("open")
      body.classList.remove("menu-open")
    })
    
  })
}
  
  
  if (overlay && menu) {
    
    overlay.addEventListener("click", () => {
      
      menu.classList.remove("open")
      body.classList.remove("menu-open")
      
    })
    
  }
  
  
  
  
  document.querySelectorAll("[data-link]").forEach(btn => {
    
    btn.addEventListener("click", () => {
      
      location.href = btn.dataset.link
      
    })
    
  })
  
}
