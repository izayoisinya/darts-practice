// ============================================
// Day詳細ビュー用ページネーション
// ============================================

let detailViewMode = false
let selectedDayData = null
let detailPageNumber = 1
let detailCompareDayKey = ""
let detailHistoryArmed = false
let detailPopstateBound = false

function ensureDetailPopstateHandler() {
  if (detailPopstateBound) return
  window.addEventListener("popstate", () => {
    // 詳細表示中の戻る操作(端スワイプ含む)は画面遷移ではなく詳細クローズを優先
    if (detailViewMode) {
      backToSummary({ fromPopState: true })
    }
  })
  detailPopstateBound = true
}

function armDetailHistoryState(dateKey) {
  if (!window.history || typeof window.history.pushState !== "function") return
  const state = window.history.state || {}
  if (state && state.dataDetailOpen) {
    detailHistoryArmed = true
    return
  }
  window.history.pushState(
    {
      ...(state || {}),
      dataDetailOpen: true,
      dataDetailKey: String(dateKey || ""),
      dataDetailAt: Date.now()
    },
    ""
  )
  detailHistoryArmed = true
}

function setDataDetailViewClass(enabled) {
  if (!document.body) return
  document.body.classList.toggle("data-detail-view", Boolean(enabled))
}

function showGameDetails(dateKey, gamesList) {
  ensureDetailPopstateHandler()
  armDetailHistoryState(dateKey)

  detailViewMode = true
  setDataDetailViewClass(true)
  selectedDayData = { dateKey, gamesList }
  detailPageNumber = 1
  detailCompareDayKey = ""
  
  const chartContainer = document.getElementById("chartContainer")
  const gameChartSection = document.getElementById("gameChartSection")
  const analysisContainer = document.getElementById("analysisContainer")
  chartContainer.style.display = "block"
  if (gameChartSection) gameChartSection.style.display = "flex"
  if (analysisContainer) analysisContainer.style.display = "none"
  
  const statsSection = document.getElementById("statsSection")
  statsSection.style.display = "flex"
  const statsContainer = document.getElementById("statsContainer")
  statsContainer.innerHTML = ""

  const awardsSection = document.getElementById("awardsSection")
  awardsSection.style.display = "flex"
  const awardsContainer = document.getElementById("awardsContainer")
  awardsContainer.innerHTML = ""

  const calendarContainer = document.getElementById("calendarContainer")
  calendarContainer.style.display = "none"
  calendarContainer.innerHTML = ""

  const summary = calcSummary(gamesList)
  addStat(statsContainer, "Games Played", summary.games)
  addStat(statsContainer, "Avg Score", summary.avgScore)
  addStat(statsContainer, "Avg PPD", summary.avgPPD)
  addStat(statsContainer, "Total Bulls", summary.totalBulls)

  addStat(awardsContainer, "Hat Trick", summary.awardCounts.hatTrick)
  addStat(awardsContainer, "3 in Black", summary.awardCounts.threeInTheBlack)
  addStat(awardsContainer, "Ton 80", summary.awardCounts.ton80)
  addStat(awardsContainer, "High Ton", summary.awardCounts.highTon)
  addStat(awardsContainer, "Low Ton", summary.awardCounts.lowTon)
  addStat(awardsContainer, "3 in Bed", summary.awardCounts.threeInTheBed)
  addStat(awardsContainer, "White Horse", summary.awardCounts.whiteHorse)

  // グループ詳細では、選択中グループのゲームだけでレーティングを再計算する
  const detailRatings = gamesList.length
    ? calculateRatings(gamesList, gamesList.length)
    : null
  renderRatingReference(detailRatings)

  setupDetailCompareControls(dateKey)

  displayDetailPage()
}

function getSessionsGroupedByDay() {
  const sessions = readSessions()
  const grouped = {}
  ;(sessions || []).forEach(s => {
    if (!s || !s.date) return
    const d = new Date(s.date)
    if (Number.isNaN(d.getTime())) return
    const key = getLocalDateKey(d)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(s)
  })
  return grouped
}

function resetDetailCompareUI() {
  const section = document.getElementById("detailCompareSection")
  const select = document.getElementById("detailCompareSelect")
  const legend = document.getElementById("detailCompareLegend")
  const tagsBox = document.getElementById("detailCompareTags")

  detailCompareDayKey = ""

  if (section) section.style.display = "none"
  if (select) {
    select.onchange = null
    select.innerHTML = ""
    select.value = ""
  }
  if (tagsBox) tagsBox.innerHTML = ""
  if (legend) {
    legend.style.display = "none"
    legend.innerHTML = ""
  }
}

function setupDetailCompareControls(currentDayKey) {
  const section = document.getElementById("detailCompareSection")
  const select = document.getElementById("detailCompareSelect")
  const legend = document.getElementById("detailCompareLegend")
  const tagsBox = document.getElementById("detailCompareTags")
  if (!section || !select) return

  if (groupedPageMode !== "day") {
    resetDetailCompareUI()
    return
  }

  const grouped = getSessionsGroupedByDay()
  const noteMap = getDayNoteMapForDetail()
  const prevKeys = Object.keys(grouped)
    .filter(key => key < currentDayKey)
    .sort((a, b) => b.localeCompare(a))

  select.innerHTML = `<option value="">比較なし</option>`
  prevKeys.forEach(key => {
    const opt = document.createElement("option")
    opt.value = key
    opt.textContent = getDetailCompareOptionLabel(key, noteMap)
    select.appendChild(opt)
  })

  if (detailCompareDayKey && prevKeys.includes(detailCompareDayKey)) {
    select.value = detailCompareDayKey
  } else {
    detailCompareDayKey = ""
    select.value = ""
  }

  section.style.display = "block"
  renderDetailCompareTags(currentDayKey, detailCompareDayKey, noteMap)

  select.onchange = () => {
    detailCompareDayKey = select.value || ""
    renderDetailCompareTags(currentDayKey, detailCompareDayKey, noteMap)
    displayDetailPage()
  }
}

function getDetailCompareOptionLabel(dayKey, noteMap) {
  const tags = getDayTagsForDetail(dayKey, noteMap)
  if (!tags.length) return dayKey
  const preview = tags.slice(0, 2).map(tag => `#${tag}`).join(" ")
  const suffix = tags.length > 2 ? ` +${tags.length - 2}` : ""
  return `${dayKey}  ${preview}${suffix}`
}

function getDayTagsForDetail(dayKey, noteMap) {
  const note = (noteMap || {})[dayKey] || {}
  return Array.isArray(note.tags)
    ? note.tags.map(tag => String(tag || "").trim()).filter(Boolean)
    : []
}

function renderDetailCompareTags(currentDayKey, compareDayKey, noteMap) {
  const tagsBox = document.getElementById("detailCompareTags")
  if (!tagsBox) return

  const currentTags = getDayTagsForDetail(currentDayKey, noteMap)
  const compareTags = compareDayKey ? getDayTagsForDetail(compareDayKey, noteMap) : []

  tagsBox.innerHTML = `
    <div class="detail-compare-tag-row">
      <span class="detail-compare-tag-label">表示中</span>
      <div class="detail-compare-tag-chips">${renderDetailCompareTagChips(currentTags)}</div>
    </div>
    <div class="detail-compare-tag-row">
      <span class="detail-compare-tag-label">比較日</span>
      <div class="detail-compare-tag-chips">${compareDayKey ? renderDetailCompareTagChips(compareTags) : '<span class="detail-compare-tag-empty">比較なし</span>'}</div>
    </div>
  `
}

function renderDetailCompareTagChips(tags) {
  if (!tags.length) {
    return '<span class="detail-compare-tag-empty">タグなし</span>'
  }

  return tags
    .map(tag => `<span class="group-note-chip">#${escapeHtmlDetail(tag)}</span>`)
    .join("")
}

function displayDetailPage() {
  if (!selectedDayData || !Array.isArray(selectedDayData.gamesList)) return
  
  const container = document.getElementById("sessionsContainer")
  container.innerHTML = ""
  
  const PAGE_SIZE = 10
  const start = (detailPageNumber - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  
  const pageData = selectedDayData.gamesList.slice(start, end).reverse()
  const dayNoteMap = getDayNoteMapForDetail()

  const label = getDetailGroupLabel(groupedPageMode, selectedDayData.dateKey)

  const topBar = document.createElement("div")
  topBar.className = "detail-topbar"

  const backBtn = document.createElement("button")
  backBtn.className = "detail-back-btn"
  backBtn.textContent = "← 戻る"
  backBtn.onclick = backToSummary

  const title = document.createElement("h3")
  title.className = "detail-group-title"
  title.textContent = label

  const rightActions = document.createElement("div")
  rightActions.className = "detail-topbar-actions"

  if (groupedPageMode === "day") {
    const memoBtn = document.createElement("button")
    memoBtn.className = "group-note-edit-btn"
    memoBtn.textContent = "Memo"
    memoBtn.onclick = () => {
      if (typeof openDayNoteEditor === "function") {
        openDayNoteEditor(selectedDayData.dateKey, label)
      }
    }
    rightActions.appendChild(memoBtn)
  }

  topBar.appendChild(backBtn)
  topBar.appendChild(title)
  topBar.appendChild(rightActions)
  container.appendChild(topBar)
  
  // ゲーム一覧
  pageData.forEach((game, idx) => {
    const gameDiv = document.createElement("div")
    const totalGames = selectedDayData.gamesList.length
    const gameNumber = end - idx

    const tags = getSessionTagsForDetail(game, dayNoteMap)
    const tagsHtml = tags.length
      ? `<div class="session-day-tags">${tags
          .map(tag => `<span class="group-note-chip">#${escapeHtmlDetail(tag)}</span>`)
          .join("")}</div>`
      : ""

    gameDiv.className = "session-card"
    gameDiv.innerHTML = `${tagsHtml}${createSessionCardHtml(game, gameNumber)}`
    container.appendChild(gameDiv)
  })

  updateDetailPaginationUI()

  let compareGamesList = null
  if (groupedPageMode === "day" && detailCompareDayKey) {
    const grouped = getSessionsGroupedByDay()
    compareGamesList = Array.isArray(grouped[detailCompareDayKey])
      ? grouped[detailCompareDayKey].filter(Boolean)
      : null
  }

  drawDetailGroupChart(
    selectedDayData.gamesList,
    compareGamesList,
    selectedDayData.dateKey,
    detailCompareDayKey
  )
}

function getDetailGroupLabel(mode, key) {
  if (mode === "week") {
    const { start, end } = getWeekRange(new Date(key))
    return `${formatShort(start)}〜${formatShort(end, false)}`
  }
  if (mode === "month") {
    const [y, m] = key.split("-")
    return `${y}/${m}`
  }
  if (mode === "year") {
    return `${key}年`
  }
  return key
}

function getDayNoteMapForDetail() {
  const raw = JSON.parse(localStorage.getItem("dartsDayNotesV2") || "{}")
  if (raw && raw.day && typeof raw.day === "object") {
    return raw.day
  }
  return raw || {}
}

function getSessionTagsForDetail(session, dayNoteMap) {
  if (!session || !session.date) return []
  const d = new Date(session.date)
  if (Number.isNaN(d.getTime())) return []
  const key = getLocalDateKey(d)
  const note = dayNoteMap[key] || {}
  return Array.isArray(note.tags) ? note.tags : []
}

function escapeHtmlDetail(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
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

function backToSummary(options = {}) {
  const fromPopState = Boolean(options && options.fromPopState)

  // 通常の戻るボタン押下時は履歴を戻して、popstate経由で同じクローズ処理を通す
  if (!fromPopState && detailHistoryArmed && window.history && window.history.length > 1) {
    window.history.back()
    return
  }

  detailViewMode = false
  setDataDetailViewClass(false)
  detailHistoryArmed = false

  if (typeof hideDetailBullRate === "function") {
    hideDetailBullRate()
  }
  
  const chartContainer = document.getElementById("chartContainer")
  chartContainer.style.display = "none"
  
  const statsSection = document.getElementById("statsSection")
  statsSection.style.display = "none"
  const statsContainer = document.getElementById("statsContainer")

  const awardsSection = document.getElementById("awardsSection")
  awardsSection.style.display = "none"
  const awardsContainer = document.getElementById("awardsContainer")
  awardsContainer.innerHTML = ""

  const calendarContainer = document.getElementById("calendarContainer")
  calendarContainer.style.display = "none"
  calendarContainer.innerHTML = ""

  
  selectedDayData = null
  resetDetailCompareUI()

  // カレンダータップで来ていた場合は元のモードに戻す
  if (calendarJumpOriginMode !== null) {
    groupedPageMode = calendarJumpOriginMode
    groupedPageData = calendarJumpOriginData
    groupedPageNumber = calendarJumpOriginPage
    calendarJumpOriginMode = null
    calendarJumpOriginData = null
    calendarJumpOriginPage = null
  }

  if (groupedPageMode && groupedPageMode !== 'game' && groupedPageData.length > 0) {
    displayGroupedPage(groupedPageMode, groupedPageData)
    renderGroupedPagination(groupedPageData.length)
    return
  }

  renderView()
}
// ============================================
// カレンダー描画
// ============================================

function drawGroupCalendar(dateKey, mode, gamesList) {
  const container = document.getElementById("calendarContainer")
  container.innerHTML = ""
  container.style.display = "block"

  const gameDates = {}
  gamesList.forEach(g => {
    if (g && g.date) {
      const dObj = new Date(g.date)
      if (!Number.isNaN(dObj.getTime())) {
        const d = getLocalDateKey(dObj)
        gameDates[d] = (gameDates[d] || 0) + 1
      }
    }
  })

  if (mode === 'year') {
    const year = parseInt(dateKey)
    container.innerHTML = renderYearCalendar(year, gameDates)
    return
  }

  let year, month
  if (mode === 'day') {
    const parts = dateKey.split('-')
    year = parseInt(parts[0])
    month = parseInt(parts[1])
  } else if (mode === 'week') {
    const d = new Date(dateKey)
    year = d.getFullYear()
    month = d.getMonth() + 1
  } else {
    const parts = dateKey.split('-')
    year = parseInt(parts[0])
    month = parseInt(parts[1])
  }

  container.innerHTML = renderMonthCalendar(year, month, dateKey, mode, gameDates)
}

function renderMonthCalendar(year, month, dateKey, mode, gameDates) {
  const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

  let hlStart = null, hlEnd = null
  if (mode === 'day') {
    hlStart = hlEnd = dateKey
  } else if (mode === 'week') {
    const { start, end } = getWeekRange(new Date(dateKey))
    hlStart = getLocalDateKey(start)
    hlEnd = getLocalDateKey(end)
  } else if (mode === 'month') {
    const lastDay = new Date(year, month, 0).getDate()
    hlStart = `${year}-${String(month).padStart(2, '0')}-01`
    hlEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  }

  const firstDate = new Date(year, month - 1, 1)
  let startOffset = firstDate.getDay()
  startOffset = startOffset === 0 ? 6 : startOffset - 1

  const daysInMonth = new Date(year, month, 0).getDate()

  let cells = DAY_LABELS.map(d => `<div class="cal-header-day">${d}</div>`).join('')

  for (let i = 0; i < startOffset; i++) {
    cells += '<div class="cal-day cal-empty"></div>'
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const count = gameDates[dateStr] || 0
    const inRange = hlStart && dateStr >= hlStart && dateStr <= hlEnd
    let cls = 'cal-day'
    if (inRange) cls += ' cal-highlight'
    if (count > 0 && !inRange) cls += ' cal-has-games'
    const dot = count > 0 ? `<span class="cal-dot"></span>` : ''
    cells += `<div class="${cls}"><span class="cal-day-num">${d}</span>${dot}</div>`
  }

  return `<div class="cal-wrap">
    <div class="cal-title">${year}年${month}月</div>
    <div class="cal-grid">${cells}</div>
  </div>`
}

function renderYearCalendar(year, gameDates) {
  let html = `<div class="cal-year-title">${year}年</div><div class="cal-year-grid">`
  for (let m = 1; m <= 12; m++) {
    html += renderMiniMonth(year, m, gameDates)
  }
  html += '</div>'
  return html
}

function renderMiniMonth(year, month, gameDates) {
  const LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const firstDate = new Date(year, month - 1, 1)
  let startOffset = firstDate.getDay()
  startOffset = startOffset === 0 ? 6 : startOffset - 1
  const daysInMonth = new Date(year, month, 0).getDate()

  let cells = LABELS.map(d => `<div class="mini-cal-hd">${d}</div>`).join('')
  for (let i = 0; i < startOffset; i++) {
    cells += '<div class="mini-cal-day"></div>'
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const hasGames = (gameDates[dateStr] || 0) > 0
    const onclick = hasGames ? ` onclick="jumpToCalendarDay('${dateStr}')"` : ""
    cells += `<div class="mini-cal-day${hasGames ? ' mini-has-games' : ''}"${onclick}>${d}</div>`
  }

  return `<div class="mini-cal-wrap">
    <div class="mini-cal-title">${month}月</div>
    <div class="mini-cal-grid">${cells}</div>
  </div>`
}
