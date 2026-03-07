// ===============================
// ===== 初期化 ==================
// ===============================

// DOM構築完了後に実行
document.addEventListener("DOMContentLoaded", () => {
  
  // デバイス判定
  detectDevice();
  
  refreshLayout()
  
  // ゲーム初期化（状態作成＋描画）
  init();
  
  // イベント登録（クリック処理など）
  registerEvents();
  
  // ===== 画面回転・サイズ変更 =====
  
  window.addEventListener("resize", refreshLayout);
  window.addEventListener("orientationchange", refreshLayout)
  
  // ===== 画面回転時にStatsを閉じる =====
  
  window.addEventListener("orientationchange", () => {
    body.classList.remove("iphone-stats-open")
  });
  
  // ===== PWA ServiceWorker =====
  
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./sw.js")
      .then(() => console.log("SW registered"))
      .catch(err => console.log("SW error", err));
  }
  
});


// ===============================
// ===== ゲーム初期化処理 ========
// ===============================
function init() {

  game.rounds = Array.from(
    { length: TOTAL_ROUNDS },
    () => [null, null, null]
  )

  loadGame()

  createNumberTable()
  setupTopButtons()

  renderRounds()
  updateStats()
  drawScoreChart()
  updateNextGameButton()

}


// ===============================
// ===== イベント登録 ============
// ===============================
function registerEvents() {
  
  const overlay = document.getElementById("menuOverlay")
  const edge = document.getElementById("menuEdge")
  const menu = document.getElementById("sideMenu")
  
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
