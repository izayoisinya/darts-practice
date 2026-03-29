// ============================================
// グループビュー用ページネーション
// ============================================

let groupedPageMode = null // "day", "week", "month", "year"
let groupedPageNumber = 1
let groupedPageData = null

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
  
  let html = `
    <div style="display:flex; gap:10px; margin:20px 0; justify-content:center;">
  `
  
  html += `
    <button onclick="changeGroupedPage(${groupedPageNumber - 1})"
      ${groupedPageNumber === 1 ? "disabled" : ""}>
      Prev
    </button>
  `
  
  html += `
    <span>${groupedPageNumber} / ${totalPages}</span>
  `
  
  html += `
    <button onclick="changeGroupedPage(${groupedPageNumber + 1})"
      ${groupedPageNumber === totalPages ? "disabled" : ""}>
      Next
    </button>
  `
  
  html += `</div>`
  
  document.getElementById("sessionsContainer")
    .insertAdjacentHTML("beforeend", html)
}

function changeGroupedPage(page) {
  
  const PAGE_SIZE = 10
  const totalPages = Math.ceil(groupedPageData.length / PAGE_SIZE)
  
  if (page < 1 || page > totalPages) return
  
  groupedPageNumber = page
  displayGroupedPage(groupedPageMode, groupedPageData)
}