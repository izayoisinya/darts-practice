// ============================================
// Day詳細ビュー用ページネーション
// ============================================

let detailViewMode = false
let selectedDayData = null
let detailPageNumber = 1

function showGameDetails(dateKey, gamesList) {
  detailViewMode = true
  selectedDayData = { dateKey, gamesList }
  detailPageNumber = 1
  
  displayDetailPage()
}

function displayDetailPage() {
  
  const container = document.getElementById("sessionsContainer")
  container.innerHTML = ""
  
  const PAGE_SIZE = 10
  const start = (detailPageNumber - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  
  const pageData = selectedDayData.gamesList.slice(start, end)
  
  // 戻るボタン
  const backBtn = document.createElement("button")
  backBtn.textContent = "← 戻る"
  backBtn.onclick = backToSummary
  backBtn.style.marginBottom = "16px"
  backBtn.style.padding = "8px 16px"
  container.appendChild(backBtn)
  
  // 日付タイトル
  const title = document.createElement("h3")
  title.textContent = selectedDayData.dateKey
  title.style.marginTop = "16px"
  container.appendChild(title)
  
  // ゲーム一覧
  pageData.forEach((game, idx) => {
    const gameDiv = document.createElement("div")
    const t = game.tripleHits || {}
    
    gameDiv.style.marginBottom = "20px"
    gameDiv.style.padding = "10px"
    gameDiv.style.border = "1px solid #333"
    gameDiv.style.borderRadius = "8px"
    
    gameDiv.innerHTML = `
      <div><strong>ゲーム ${idx + 1}</strong></div>
      <div>Score: ${game.score}</div>
      <div>PPD: ${game.ppd}</div>
      <div>Bulls: ${game.bulls ?? "-"}</div>
      <div>Inner Bulls: ${game.innerBulls ?? "-"}</div>
      <div>T20: ${t[20] ?? 0} / T19: ${t[19] ?? 0} / T18: ${t[18] ?? 0} / T17: ${t[17] ?? 0} / T16: ${t[16] ?? 0} / T15: ${t[15] ?? 0}</div>
    `
    container.appendChild(gameDiv)
  })
  
  // ページネーション
  renderDetailPagination(selectedDayData.gamesList.length)
}

function renderDetailPagination(total) {
  
  const PAGE_SIZE = 10
  const totalPages = Math.ceil(total / PAGE_SIZE)
  
  let html = `
    <div style="display:flex; gap:10px; margin:20px 0; justify-content:center;">
  `
  
  html += `
    <button onclick="changeDetailPage(${detailPageNumber - 1})"
      ${detailPageNumber === 1 ? "disabled" : ""}>
      Prev
    </button>
  `
  
  html += `
    <span>${detailPageNumber} / ${totalPages}</span>
  `
  
  html += `
    <button onclick="changeDetailPage(${detailPageNumber + 1})"
      ${detailPageNumber === totalPages ? "disabled" : ""}>
      Next
    </button>
  `
  
  html += `</div>`
  
  document.getElementById("sessionsContainer")
    .insertAdjacentHTML("beforeend", html)
}

function changeDetailPage(page) {
  
  const PAGE_SIZE = 10
  const totalPages = Math.ceil(selectedDayData.gamesList.length / PAGE_SIZE)
  
  if (page < 1 || page > totalPages) return
  
  detailPageNumber = page
  displayDetailPage()
}

function backToSummary() {
  detailViewMode = false
  selectedDayData = null
  renderView()
}