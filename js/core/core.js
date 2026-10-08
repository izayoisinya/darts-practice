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


// ==========================
// サイドメニュー（全画面共通）
// ==========================
// 各画面の <div id="sideMenu"> の中身をここで作る。メニューを変えるときはここだけ直す。
// 開閉の動き（スワイプなど）は main.js の setupSideMenu()
const SIDE_MENU_GROUPS = [
  {
    title: "Game",
    items: [
      { label: "CountUp", link: "countup.html" },
      { label: "01", link: "countup.html?game=01" },
      { label: "Cricket", link: "countup.html?game=cricket" }
    ]
  },
  {
    title: "Utility",
    items: [
      { label: "Data", link: "data.html" },
      { label: "Settings", link: "settings.html" },
      { label: "Info", link: "news.html" }
    ]
  },
  {
    // 進行中のゲームの操作（カウントアップ画面だけ）
    title: "This Game",
    pages: ["countup.html", "countup.html?game=01", "countup.html?game=cricket"],
    items: [
      { label: "Reset Game", action: "forceResetGame", danger: true }
    ]
  }
]

// 今の画面（01 は countup.html?game=01、クリケットは countup.html?game=cricket として区別する）
function getCurrentPageName() {
  const name = location.pathname.split("/").pop() || "index.html"
  return typeof GAME_TYPE !== "undefined" && GAME_TYPE !== "countup" ? `${name}?game=${GAME_TYPE}` : name
}

function renderSideMenuItem(item, page) {

  if (item.soon) {
    return `<button type="button" disabled>${item.label}<span class="menu-soon">Coming Soon</span></button>`
  }

  if (item.action) {
    return `<button type="button" class="${item.danger ? "menu-danger" : ""}" data-action="${item.action}">${item.label}</button>`
  }

  const current = item.link === page ? ' class="current" aria-current="page"' : ""
  return `<button type="button" data-link="${item.link}"${current}>${item.label}</button>`
}

function renderSideMenu() {

  const menu = document.getElementById("sideMenu")
  if (!menu) return

  const page = getCurrentPageName()

  const groups = SIDE_MENU_GROUPS
    .filter(group => !group.pages || group.pages.includes(page))
    .map(group => `
      <div class="menu-group">
        <div class="menu-group-title">${group.title}</div>
        ${group.items.map(item => renderSideMenuItem(item, page)).join("")}
      </div>
    `)
    .join("")

  menu.innerHTML = `
    <div class="menu-header">Menu</div>
    ${renderSideMenuItem({ label: "Main Menu", link: "index.html" }, page)}
    ${groups}
  `

  // 操作のボタン（Reset Game など）は、その画面にある関数を呼ぶ
  menu.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = window[btn.dataset.action]
      if (typeof action === "function") action()
    })
  })
}
