// ===============================
// ===== ダーツ1本描画 ==========
// ===============================
function renderDart(dart) {
  
  if (!dart) return `<span class="dart">-</span>`
  
  let cls = ""
  
  if (dart.score === 0) cls = " miss"
  else if (dart.special === "innerBull") cls = " inner-bull"
  else if (dart.special === "outerBull") cls = " outer-bull"
  else if (dart.multiplier === 3) cls = " triple"
  else if (dart.multiplier === 2) cls = " double"
  
  return `<span class="dart${cls}"
    onclick="editDart(${roundIndex}, ${dartIndex})">
    ${dart.score}
  </span>`
}


function editDart(r, d) {
  
  if (r !== game.currentRound) return
  
  game.rounds[r][d] = null
  
  renderRounds()
  updateStats()
  drawScoreChart()
  saveGame()
}


// ===============================
// ===== ラウンド描画 ============
// ===============================
function renderDart(dart, roundIndex, dartIndex) {
  
  if (!dart) {
    return `<span class="dart"
      onclick="editDart(${roundIndex}, ${dartIndex})">-</span>`
  }
  
  let cls = ""
  
  if (dart.score === 0) cls = " miss"
  else if (dart.special === "innerBull") cls = " inner-bull"
  else if (dart.special === "outerBull") cls = " outer-bull"
  else if (dart.multiplier === 3) cls = " triple"
  else if (dart.multiplier === 2) cls = " double"
  
  return `<span class="dart${cls}"
    onclick="editDart(${roundIndex}, ${dartIndex})">
    ${dart.score}
  </span>`
}


// ===============================
// ===== 数字テーブル ============
// ===============================
function createNumberTable() {
  
  const table = document.getElementById("numberTable");
  if (!table) return;
  
  table.innerHTML = "";
  
  const isPhoneLandscape =
    document.body.classList.contains("phone") &&
    document.body.classList.contains("landscape");
  
  // ===============================
  // iPhone横 → 2カラム
  // ===============================
  if (isPhoneLandscape) {
    
    const leftColumn = document.createElement("div");
    leftColumn.className = "number-column";
    
    for (let i = 20; i >= 11; i--) {
      leftColumn.appendChild(createNumberRow(i));
    }
    
    const rightColumn = document.createElement("div");
    rightColumn.className = "number-column";
    
    for (let i = 10; i >= 1; i--) {
      rightColumn.appendChild(createNumberRow(i));
    }
    
    table.appendChild(leftColumn);
    table.appendChild(rightColumn);
    
  }
  
  // ===============================
  // iPad / PC → 1カラム
  // ===============================
  else {
    
    for (let i = 20; i >= 1; i--) {
      table.appendChild(createNumberRow(i));
    }
    
  }
  
  
}


function createNumberRow(num) {
  
  const row = document.createElement("div");
  row.className = "number-row";
  
  // Single
  const single = document.createElement("button");
  single.textContent = num;
  single.addEventListener("click", () => {
    addDart(num, 1);
  });
  
  // Double
  const double = document.createElement("button");
  double.textContent = "D";
  double.addEventListener("click", () => {
    addDart(num, 2);
  });
  
  // Triple
  const triple = document.createElement("button");
  triple.textContent = "T";
  triple.addEventListener("click", () => {
    addDart(num, 3);
  });
  
  row.appendChild(single);
  row.appendChild(double);
  row.appendChild(triple);
  
  return row;
}


// ===============================
// ===== 上部ボタン設定 ===========
// ===============================
function setupTopButtons() {
  
  // .top-buttons 内の全ボタン取得
  document
    .querySelectorAll(".top-buttons button")
    .forEach(btn => {
      
      // --------------------------------------
      // Undoボタンは特別処理
      // --------------------------------------
      if (btn.id === "undoBtn") {
        btn.addEventListener("click", undoDart);
        return;
      }
      
      
      // --------------------------------------
      // その他ボタン
      // --------------------------------------
      btn.addEventListener("click", () => {
        
        const type = btn.dataset.display;
        
        
        // Bull
        if (type === "Bull") {
          addDart(
            25,
            bullMode === "fat" ? 2 : 1,
            "outerBull"
          );
        }
        
        
        // Inner Bull
        if (type === "InBull") {
          addDart(25, 2, "innerBull");
        }
        
        
        // Miss
        if (type === "Miss") {
          addDart(0, 1);
        }
        
      });
    });
}


// ===============================
// デバイス判定関数
// ===============================
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
  
  const isIPhone = /iPhone/i.test(ua)
  const isIPad =
    /iPad/i.test(ua) ||
    (ua.includes("Macintosh") && "ontouchend" in document)
  
  const isAndroid = /Android/i.test(ua)
  
  // ===== デバイス判定 =====
  
  if (isIPhone) {
    body.classList.add("phone")
  }
  
  else if (isAndroid && w < 900) {
    body.classList.add("phone")
  }
  
  else if (isAndroid || isIPad) {
    body.classList.add("tablet")
  }
  
  else {
    body.classList.add("desktop")
  }
  
  // ===== 向き判定 =====
  
  if (h > w) {
    body.classList.add("portrait")
  } else {
    body.classList.add("landscape")
  }
  
}


function refreshLayout() {
  
  detectDevice()
  createNumberTable()
  drawScoreChart()
  
}
