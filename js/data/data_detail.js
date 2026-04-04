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
  
  const chartContainer = document.getElementById("chartContainer")
  chartContainer.style.display = "block"
  
  const statsContainer = document.getElementById("statsContainer")
  statsContainer.style.display = "flex"
  statsContainer.innerHTML = ""
  
  // グループ期間のスタッツを表示
  const summary = calcSummary(gamesList)
  addStat(statsContainer, "Games Played", summary.games)
  addStat(statsContainer, "Avg Score", summary.avgScore)
  addStat(statsContainer, "Avg PPD", summary.avgPPD)
  addStat(statsContainer, "Total Bulls", summary.totalBulls)
  
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
    const totalGames = selectedDayData.gamesList.length
    const globalIndex = start + idx
    const gameNumber = totalGames - globalIndex
    gameDiv.className = "session-card"
    gameDiv.innerHTML = createSessionCardHtml(game, gameNumber)
    container.appendChild(gameDiv)
  })

  updateDetailPaginationUI()
  drawDetailGroupChart(selectedDayData.gamesList)
}

function updateDetailPaginationUI() {
  if (!selectedDayData || !selectedDayData.gamesList) return

  const totalPages = Math.max(
    1,
    Math.ceil(selectedDayData.gamesList.length / PAGE_SIZE)
  )

  document.getElementById('pageInfo').textContent =
    `${detailPageNumber} / ${totalPages}`

  document.getElementById('prevBtn').disabled = detailPageNumber === 1
  document.getElementById('nextBtn').disabled = detailPageNumber === totalPages
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
  
  const chartContainer = document.getElementById("chartContainer")
  chartContainer.style.display = "none"
  
  const statsContainer = document.getElementById("statsContainer")
  statsContainer.style.display = "none"
  
  selectedDayData = null

  if (groupedPageMode && groupedPageMode !== 'game' && groupedPageData.length > 0) {
    displayGroupedPage(groupedPageMode, groupedPageData)
    renderGroupedPagination(groupedPageData.length)
    return
  }

  renderView()
}