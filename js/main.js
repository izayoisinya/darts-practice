// ===============================
// ===== 初期化 ==================
// ===============================

// DOM構築完了後に実行
document.addEventListener("DOMContentLoaded", () => {
  
  // デバイス判定
  detectDevice();
  
  // ゲーム初期化（状態作成＋描画）
  init();
  
  // イベント登録（クリック処理など）
  registerEvents();
  
  // ===== 画面回転・サイズ変更 =====
  
  window.addEventListener("resize", refreshLayout);
  
  // ===== 画面回転時にStatsを閉じる =====
  
  window.addEventListener("orientationchange", () => {
    document.body.classList.remove("iphone-stats-open");
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
  updateNextGameButton()
drawScoreChart()
}


// ===============================
// ===== イベント登録 ============
// ===============================
function registerEvents() {
  
  const menu = document.getElementById("sideMenu")
  const overlay = document.getElementById("menuOverlay")
  
  const nextBtn = document.getElementById("nextGameBtn")
  if (nextBtn) {
    nextBtn.addEventListener("click", resetGame)
  }
  
  const statsArea = document.querySelector(".stats-area")
  
  statsArea.addEventListener("click", (e) => {
    
    if (e.target.closest(".stats-detail")) return
    
    if (
      document.body.classList.contains("phone") &&
      document.body.classList.contains("landscape")
    ) {
      
      document.body.classList.toggle("iphone-stats-open")
      
      setTimeout(() => {
        drawScoreChart()
      }, 300)
      
    }
    
  })
  
  const roundArea = document.querySelector(".round-area")
  
  roundArea.addEventListener("click", () => {
    
    if (
      document.body.classList.contains("phone") &&
      document.body.classList.contains("portrait")
    ) {
      document.body.classList.toggle("round-open")
    }
    
  })
  
  
  // ===== side menu =====
  
  document.querySelectorAll(".side-menu button").forEach(btn => {
    
    btn.addEventListener("click", () => {
      
      menu.classList.remove("open")
      document.body.classList.remove("menu-open")
      
    })
    
  })
  
  
  if (overlay && menu) {
    
    overlay.addEventListener("click", () => {
      
      menu.classList.remove("open")
      document.body.classList.remove("menu-open")
      
    })
    
  }
  
  
  document.querySelectorAll("[data-link]").forEach(btn => {
    
    btn.addEventListener("click", () => {
      
      location.href = btn.dataset.link
      
    })
    
  })
  
}
