// ============================================
// グループビュー用ページネーション
// ============================================
function renderGroupedPaginated(mode) {
  
  const sessions = JSON.parse(
    localStorage.getItem("dartsSessions")
  ) || []
  
  const container = document.getElementById("sessionsContainer")
  container.innerHTML = ""
  
  const groups = groupSessions(sessions, mode)
  const sortedEntries = Object.entries(groups)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
  
  groupedPageMode = mode
  groupedPageData = sortedEntries
  groupedPageNumber = 1
  
  displayGroupedPage(mode, sortedEntries)
}

function displayGroupedPage(mode, sortedEntries) {
  
  const container = document.getElementById("sessionsContainer")
  container.innerHTML = ""
  
  const PAGE_SIZE = 10
  const start = (groupedPageNumber - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  
  const pageData = sortedEntries.slice(start, end)
  
  // グループカードを表示
  pageData.forEach(([key, list]) => {
    
    const summary = calcSummary(list)
    
    let label = key
    
    if (mode === "week") {
      const { start, end } = getWeekRange(new Date(key))
      label = `${formatShort(start)}〜${formatShort(end, false)}`
    }
    
    if (mode === "month") {
      const [y, m] = key.split("-")
      label = `${y}/${m}`
    }
    
    if (mode === "year") {
      label = `${key}年`
    }
    
    const div = document.createElement("div")
    
    div.innerHTML = `
      <div style="margin-bottom:12px;border:1px solid #333;padding:10px;cursor:pointer;">
        <strong>${label}</strong><br>
        Games: ${summary.games}<br>
        Avg Score: ${summary.avgScore}<br>
        Avg PPD: ${summary.avgPPD}<br>
        Bulls: ${summary.totalBulls}
      </div>
    `
    
    div.querySelector("div").onclick = () => showGameDetails(key, list)
    container.appendChild(div)
  })
  
  // ページネーション表示
  renderGroupedPagination(sortedEntries.length)
}

function renderGroupedPagination(total) {
  const PAGE_SIZE = 10
  const totalPages = Math.ceil(total / PAGE_SIZE)
  
  document.getElementById('pageInfo').textContent = 
    `${groupedPageNumber} / ${totalPages}`
  
  document.getElementById('prevBtn').disabled = groupedPageNumber === 1
  document.getElementById('nextBtn').disabled = groupedPageNumber === totalPages
}


function changeGroupedPage(page) {
  const PAGE_SIZE = 10
  const totalPages = Math.ceil(groupedPageData.length / PAGE_SIZE)
  
  if (page < 1 || page > totalPages) return
  
  groupedPageNumber = page
  displayGroupedPage(groupedPageMode, groupedPageData)
}

// グループビュー（Day/Week/Month/Year）を表示する際に呼び出す
function displayGroupView(mode) {
  groupedPageMode = mode
  groupedPageNumber = 1
  
  const sessions = JSON.parse(
    localStorage.getItem("dartsSessions")
  ) || []
  
  // モードに応じたグループ化
  const groups = groupSessions(sessions, mode)
  const sortedEntries = Object.entries(groups)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
  
  groupedPageData = sortedEntries
  
  // ページネーションを更新
  if (groupedPageData && groupedPageData.length > 0) {
    renderGroupedPagination(groupedPageData.length)
    displayGroupedPage(mode, groupedPageData)
  }
}
