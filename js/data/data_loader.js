// データ画面で扱うゲームの記録（今はカウントアップだけ。01 の記録は混ぜない）
function readDataSessions() {
  return readSessions().filter(session => (session.gameType || "countup") === "countup")
}

// maxScore：縦軸の上限（カウントアップ・01 は 180。クリケットはマーク数なので 9）
function createRoundChartHtml(roundSource, maxScore = 180) {
  const scores = Array.isArray(roundSource)
    ? (roundSource.length > 0 && typeof roundSource[0] === "number"
      ? roundSource.map(score => Number(score) || 0)
      : roundSource.map(round =>
        (round || []).reduce((sum, dart) => sum + (dart?.score || 0), 0)
      ))
    : []
  const n = scores.length
  if (n === 0) return '<svg class="round-line-chart" viewBox="0 0 240 120" preserveAspectRatio="xMidYMid meet"></svg>'

  const svgW = 240, svgH = 120
  const mTop = 10, mRight = 8, mBottom = 14, mLeft = 8
  const chartW = svgW - mLeft - mRight
  const chartH = svgH - mTop - mBottom
  const xStep = n > 1 ? chartW / (n - 1) : 0

  const pts = scores.map((s, i) => ({
    x: mLeft + i * xStep,
    y: mTop + (1 - s / maxScore) * chartH,
    s
  }))

  const polyPoints = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const baseY = mTop + chartH
  const areaPoints =
    `${pts[0].x.toFixed(1)},${baseY} ` +
    pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
    ` ${pts[n - 1].x.toFixed(1)},${baseY}`

  const gridLines = [maxScore / 3, maxScore / 3 * 2, maxScore].map(v => {
    const y = (mTop + (1 - v / maxScore) * chartH).toFixed(1)
    return `<line x1="${mLeft}" y1="${y}" x2="${svgW - mRight}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`
  }).join('')

  const valueLabels = pts.map(p =>
    `<text x="${p.x.toFixed(1)}" y="${(p.y - 3).toFixed(1)}" text-anchor="middle" font-size="8" fill="rgba(255,255,255,0.7)">${p.s}</text>`
  ).join('')

  const xLabels = pts.map((p, i) =>
    `<text x="${p.x.toFixed(1)}" y="${svgH - 2}" text-anchor="middle" font-size="8" fill="rgba(255,255,255,0.5)">R${i + 1}</text>`
  ).join('')

  const dots = pts.map(p =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="var(--accent)" stroke="#11151c" stroke-width="1.5"/>`
  ).join('')

  return `<svg class="round-line-chart" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid meet">
    ${gridLines}
    <polygon points="${areaPoints}" fill="var(--accent)" fill-opacity="0.15"/>
    <polyline points="${polyPoints}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${valueLabels}
    ${xLabels}
    ${dots}
  </svg>`
}

function getSessionAwards(session) {
  const base = {
    hatTrick: 0,
    lowTon: 0,
    highTon: 0,
    ton80: 0,
    threeInTheBlack: 0,
    threeInTheBed: 0,
    whiteHorse: 0
  }

  if (session && session.awards) {
    return { ...base, ...session.awards }
  }

  // 判定は stats.js の countRoundAwards() に一本化
  return { ...base, ...countRoundAwards(session?.rounds || []) }
}

// アワードの表示名（表示順）
const AWARD_LABELS = [
  ["hatTrick", "Hat Trick"],
  ["threeInTheBlack", "3 in the Black"],
  ["ton80", "Ton 80"],
  ["highTon", "High Ton"],
  ["lowTon", "Low Ton"],
  ["threeInTheBed", "3 in the Bed"],
  ["whiteHorse", "White Horse"]
]

// labels：出すアワード（クリケットは data_cricket.js の DATA_CRICKET_AWARD_LABELS）
function createAwardsHtml(session, labels = AWARD_LABELS) {
  const awards = getSessionAwards(session)
  const awardDefs = labels.map(([key, label]) => [label, awards[key] || 0])

  const activeAwards = awardDefs.filter(([, count]) => count > 0)
  if (!activeAwards.length) {
    return '<div class="session-awards-empty">No Awards</div>'
  }

  return activeAwards
    .map(([label, count]) => `
      <div class="session-award-item">
        <span class="session-award-label">${label}</span>
        <span class="session-award-count">${count}</span>
      </div>
    `)
    .join("")
}

function createSessionCardHtml(session, gameNumber) {
  const t = session.tripleHits || {}
  const roundSource = Array.isArray(session.roundScores)
    ? session.roundScores
    : session.rounds
  const roundChartHtml = createRoundChartHtml(roundSource)
  const awardsHtml = createAwardsHtml(session)
  const totalDarts = (session?.rounds || [])
    .flat()
    .filter(d => d)
    .length
  const bullRateNum = totalDarts > 0
    ? ((session?.bulls || 0) / totalDarts) * 100
    : Number(session?.bullRate || 0)
  const innerRateNum = totalDarts > 0
    ? ((session?.innerBulls || 0) / totalDarts) * 100
    : Number(session?.innerRate || 0)
  const bullRate = Number.isFinite(bullRateNum) ? bullRateNum.toFixed(1) : "0.0"
  const innerRate = Number.isFinite(innerRateNum) ? innerRateNum.toFixed(1) : "0.0"

  // 縮小表示用の要約（ブル数とアワード）
  const sessionAwards = getSessionAwards(session)
  const awardSummary = AWARD_LABELS
    .filter(([key]) => (sessionAwards[key] || 0) > 0)
    .map(([key, label]) => `${label} ${sessionAwards[key]}`)
  const compactSummary = [
    `Bull ${session.bulls ?? 0}（${bullRate}%）`,
    `In ${session.innerBulls ?? 0}`,
    ...awardSummary
  ].join(" · ")
  const tripleHtml = `
    <div class="session-triple-grid">
      <div class="session-triple-item"><span class="session-triple-label">20:</span><span class="session-triple-value">${t[20] ?? 0}</span></div>
      <div class="session-triple-item"><span class="session-triple-label">19:</span><span class="session-triple-value">${t[19] ?? 0}</span></div>
      <div class="session-triple-item"><span class="session-triple-label">18:</span><span class="session-triple-value">${t[18] ?? 0}</span></div>
      <div class="session-triple-item"><span class="session-triple-label">17:</span><span class="session-triple-value">${t[17] ?? 0}</span></div>
      <div class="session-triple-item"><span class="session-triple-label">16:</span><span class="session-triple-value">${t[16] ?? 0}</span></div>
      <div class="session-triple-item"><span class="session-triple-label">15:</span><span class="session-triple-value">${t[15] ?? 0}</span></div>
    </div>
  `

  return `
    <div class="session-card-header">
      <strong>Game ${gameNumber}</strong>
      <span class="session-card-header-right">
        <span class="session-date">${new Date(session.date).toLocaleString()}</span>
        <span class="session-toggle-icon" aria-hidden="true"></span>
      </span>
    </div>

    <div class="session-card-body">
      <div class="session-main-block">
        <div class="session-kpi-grid">
          <div class="session-kpi-item">
            <span class="session-kpi-label">Score</span>
            <span class="session-kpi-value">${session.score}</span>
          </div>
          <div class="session-kpi-item">
            <span class="session-kpi-label">PPD</span>
            <span class="session-kpi-value">${session.ppd}</span>
          </div>
          <div class="session-kpi-item">
            <span class="session-kpi-label">Round Avg</span>
            <span class="session-kpi-value">${session.roundAvg ?? "-"}</span>
          </div>
        </div>

        <div class="session-compact-summary">${compactSummary}</div>

        <div class="session-rate-group">
          <div class="stat-row session-stat-row">
            <span class="label">Bull</span>
            <span class="count">${session.bulls ?? 0}</span>
            <div class="bar-bg">
              <div class="bar-fill" style="width:${bullRate}%"></div>
            </div>
            <span class="percent">${bullRate}%</span>
          </div>

          <div class="stat-row session-stat-row">
            <span class="label">In</span>
            <span class="count">${session.innerBulls ?? 0}</span>
            <div class="bar-bg">
              <div class="bar-fill inner" style="width:${innerRate}%"></div>
            </div>
            <span class="percent">${innerRate}%</span>
          </div>
        </div>

        <div class="session-meta-block session-triple-block">
          <div class="session-meta-title">Triple</div>
          ${tripleHtml}
        </div>

        <!-- アワードはトリプルの下（左の列）に置く -->
        <div class="session-meta-block session-awards-block">
          <div class="session-meta-title">Awards</div>
          <div class="session-awards-grid">${awardsHtml}</div>
        </div>
      </div>

      <div class="session-side-block">
        <div class="session-meta-block session-round-block">
          <div class="session-meta-title">Round Scores</div>
          <div class="round-chart">${roundChartHtml}</div>
        </div>
        ${typeof createSessionHeatmapHtml === "function" ? createSessionHeatmapHtml(session, true) : ""}
      </div>
    </div>

  `
}

// ===============================
// ===== History（全ゲームを 1 か所に） =====
// ===============================
// History（記録）の画面は、Count-Up・01・Cricket の全ゲームを新しい順に 1 本の一覧で出す。
// 上のボタン（All / Count-Up / 01 / Cricket）でゲームの種類を絞り込める（historyFilter）。
// カードの中身はゲームごとの形（createSessionCardHtml / createZeroOneCardHtml / createCricketCardHtml）で、
// 見出しはゲームの種類の印だけ（「Game n」の番号は出さない）
const HISTORY_GAME_LABELS = { countup: "Count-Up", "01": "01", cricket: "Cricket" }

// History の絞り込み（"all" / "countup" / "01" / "cricket"）
let historyFilter = "all"

function getHistoryGameType(session) {
  const type = session && (session.gameType || "countup")
  if (type === "01") return session.zeroOne ? "01" : null
  if (type === "cricket") return session.cricket ? "cricket" : null
  return type === "countup" ? "countup" : null
}

function readHistorySessions() {
  return readSessions().filter(session => getHistoryGameType(session))
}

// 絞り込んだ履歴（古い順。[{ session, type, number }]。number はカードを作る関数に渡すだけで、見出しには出さない）
function getHistoryItems() {
  const counters = {}
  return readHistorySessions()
    .map(session => {
      const type = getHistoryGameType(session)
      counters[type] = (counters[type] || 0) + 1
      return { session, type, number: counters[type] }
    })
    .filter(item => historyFilter === "all" || item.type === historyFilter)
    .filter(item => dayMatchesTagFilter(getLocalDateKey(new Date(item.session.date))))
}

function getHistoryTotalPages() {
  return Math.max(1, Math.ceil(getHistoryItems().length / PAGE_SIZE))
}

// ===============================
// ===== タグの絞り込み（History と Stats の Tag Search で共通） =====
// ===============================
// 日別メモのタグ（data_notes.js の getDayNote()）で絞る。選んだタグは History と Stats（Count-Up）の Tag Search の両方に効く。
// 2 つ以上選んだら、どれかが付いた日（OR）か、全部付いた日（AND）かを選べる
let dataTagFilter = []
let dataTagMode = "or"

function normalizeDataTag(tag) {
  return String(tag || "").trim().replace(/^#/, "")
}

function getDayTags(dayKey) {
  if (typeof getDayNote !== "function") return []
  const tags = getDayNote(dayKey).tags
  return Array.isArray(tags) ? tags.map(normalizeDataTag).filter(Boolean) : []
}

// 使われているタグと、そのタグの付いた日数（多い順）
function getDataTagList() {
  if (typeof getAllDayNotes !== "function") return []
  const counts = {}
  Object.keys(getAllDayNotes() || {}).forEach(dayKey => {
    new Set(getDayTags(dayKey)).forEach(tag => {
      counts[tag] = (counts[tag] || 0) + 1
    })
  })
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
}

function isDataTagFilterActive() {
  return dataTagFilter.length > 0
}

function dayMatchesTagFilter(dayKey) {
  if (!dataTagFilter.length) return true
  const tags = getDayTags(dayKey)
  return dataTagMode === "and"
    ? dataTagFilter.every(tag => tags.includes(tag))
    : dataTagFilter.some(tag => tags.includes(tag))
}

// 絞り込みのボタン（タグがなければ何も出さない）
function renderDataTagFilterHtml() {
  const list = getDataTagList()
  if (!list.length) return ""

  // 選んだタグがメモから消えていたら外す
  dataTagFilter = dataTagFilter.filter(tag => list.some(([name]) => name === tag))

  const chips = list.map(([tag, days]) => {
    const active = dataTagFilter.includes(tag)
    return `<button type="button" class="tag-filter-chip${active ? " active" : ""}" data-tag-filter="${encodeURIComponent(tag)}" aria-pressed="${active}">#${escapeHtml(tag)}<small>${days}</small></button>`
  }).join("")

  const mode = dataTagFilter.length >= 2
    ? `<span class="tag-filter-mode" role="group" aria-label="タグの組み合わせ">
        <button type="button" data-tag-mode="or" class="${dataTagMode === "or" ? "active" : ""}">OR</button>
        <button type="button" data-tag-mode="and" class="${dataTagMode === "and" ? "active" : ""}">AND</button>
      </span>`
    : ""
  const clear = dataTagFilter.length ? '<button type="button" class="tag-filter-clear" data-tag-clear>Clear</button>' : ""

  return `
    <div class="tag-filter${dataTagFilter.length ? " is-active" : ""}">
      <span class="tag-filter-label">Tags</span>
      <div class="tag-filter-chips">${chips}</div>
      ${mode}${clear}
    </div>
  `
}

// 絞り込みを変えたら、今出している画面（History か Stats の Tag Search）を描き直す
function refreshDataTagFilterViews() {
  currentPage = 1
  if (typeof viewMode !== "undefined" && viewMode === "stats") {
    if (typeof renderTagSearch === "function") renderTagSearch()
  } else if (typeof viewMode !== "undefined" && viewMode === "history") {
    renderHistory()
    const container = document.getElementById("sessionsContainer")
    if (container) container.scrollTop = 0
  }
}

let dataTagFilterBound = false

function setupDataTagFilter() {
  if (dataTagFilterBound) return
  dataTagFilterBound = true
  document.addEventListener("click", e => {
    const target = e.target instanceof Element ? e.target : null
    if (!target) return
    const chip = target.closest("[data-tag-filter]")
    const mode = target.closest("[data-tag-mode]")
    const clear = target.closest("[data-tag-clear]")
    if (chip) {
      const tag = decodeURIComponent(chip.dataset.tagFilter)
      dataTagFilter = dataTagFilter.includes(tag) ? dataTagFilter.filter(t => t !== tag) : dataTagFilter.concat(tag)
    } else if (mode) {
      dataTagMode = mode.dataset.tagMode === "and" ? "and" : "or"
    } else if (clear) {
      dataTagFilter = []
    } else {
      return
    }
    refreshDataTagFilterViews()
  })
}

function setHistoryFilter(filter) {
  historyFilter = ["countup", "01", "cricket"].includes(filter) ? filter : "all"
  currentPage = 1
  renderHistory()
  const container = document.getElementById("sessionsContainer")
  if (container) container.scrollTop = 0
}

function updateHistoryFilterButtons() {
  document.querySelectorAll("#historyFilter button").forEach(btn => {
    const active = btn.dataset.filter === historyFilter
    btn.classList.toggle("active", active)
    btn.setAttribute("aria-pressed", active ? "true" : "false")
  })
}

function createHistoryCardHtml(session, gameNumber) {
  const type = getHistoryGameType(session)
  if (type === "01" && typeof createZeroOneCardHtml === "function") return createZeroOneCardHtml(session, gameNumber)
  if (type === "cricket" && typeof createCricketCardHtml === "function") return createCricketCardHtml(session, gameNumber)
  return createSessionCardHtml(session, gameNumber)
}

function loadSessions() {

  const items = getHistoryItems()

  const container = document.getElementById("sessionsContainer")
  container.innerHTML = ""
  updateHistoryFilterButtons()

  const tagBox = document.getElementById("historyTagFilter")
  if (tagBox) tagBox.innerHTML = renderDataTagFilterHtml()

  if (!items.length) {
    container.innerHTML = isDataTagFilterActive()
      ? '<p class="history-empty">選んだタグの日のゲームはありません</p>'
      : '<p class="history-empty">No data</p>'
    return
  }

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  currentPage = Math.min(Math.max(1, currentPage), totalPages)

  const start = (currentPage - 1) * PAGE_SIZE

  items.slice().reverse().slice(start, start + PAGE_SIZE).forEach(({ session, type, number }) => {
    container.appendChild(createHistoryCardElement(session, type, number))
  })
}

// 履歴カード（見出しにゲームの種類の印）。データのトップの「その日のゲーム」でも使う
function createHistoryCardElement(session, type, number) {
  const card = createSessionCardElement(createHistoryCardHtml(session, number))
  card.classList.add(`history-${type === "01" ? "zeroone" : type}`)

  // 見出しはゲームの種類だけ（「Game n」の番号は種類ごとに数えていて分かりにくいので出さない）
  const title = card.querySelector(".session-card-header strong")
  if (title) {
    title.innerHTML = `<span class="history-game-badge">${HISTORY_GAME_LABELS[type]}</span>`
  }
  return card
}

// History を描いてページ送りの表示も合わせる
function renderHistory() {
  loadSessions()
  updatePaginationUI(getHistoryTotalPages())
}

function getLocalDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

// フッターの Prev / Next（History の全ゲームの一覧）
function changePage(direction) {
  const totalPages = getHistoryTotalPages()
  if (direction === "Prev" && currentPage > 1) currentPage--
  if (direction === "Next" && currentPage < totalPages) currentPage++

  renderHistory()
  const container = document.getElementById("sessionsContainer")
  if (container) container.scrollTop = 0
}

function updatePaginationUI(totalPages) {
  totalPages = Math.max(1, totalPages || 0)

  // ページ情報を更新
  document.getElementById('pageInfo').textContent =
    `${currentPage} / ${totalPages}`
  
  // ボタンの有効/無効を切り替え
  document.getElementById('prevBtn').disabled = currentPage === 1
  document.getElementById('nextBtn').disabled = currentPage === totalPages
}

// History のページ（10 ゲームずつ）
let currentPage = 1
const PAGE_SIZE = 10

// ページロード時の初期化
window.addEventListener('DOMContentLoaded', () => {
  initDataPage()
})

// 履歴カード：普段は縮小表示。タップ（クリック・Enter）で全項目の表示と切り替える
let sessionCardToggleBound = false

function toggleSessionCard(card) {
  const expanded = card.classList.toggle("is-expanded")
  card.setAttribute("aria-expanded", expanded ? "true" : "false")

  // 開いたらそのゲームのヒートマップを描く（heatmap.js）
  if (expanded && typeof drawSessionHeatmaps === "function") {
    requestAnimationFrame(() => drawSessionHeatmaps(card))
  }
}

function setupSessionCardToggle() {
  if (sessionCardToggleBound) return

  const container = document.getElementById("sessionsContainer")
  if (!container) return

  container.addEventListener("click", e => {
    const card = e.target instanceof Element ? e.target.closest(".session-card") : null
    if (card && container.contains(card)) toggleSessionCard(card)
  })

  container.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return
    const card = e.target instanceof Element ? e.target.closest(".session-card") : null
    if (!card || e.target !== card) return
    e.preventDefault()
    toggleSessionCard(card)
  })

  sessionCardToggleBound = true
}

// 履歴カードの外枠（縮小表示で作る）
function createSessionCardElement(innerHtml) {
  const div = document.createElement("div")
  div.className = "session-card"
  div.setAttribute("role", "button")
  div.setAttribute("tabindex", "0")
  div.setAttribute("aria-expanded", "false")
  div.innerHTML = innerHtml
  return div
}

async function initDataPage() {
  setupSessionCardToggle()
  setupDataTagFilter()

  if (typeof initSessionsStorage === "function") {
    await initSessionsStorage()
  }

  currentPage = 1

  renderHistory()

  if (typeof initDataGameSwitch === "function") initDataGameSwitch()

  // 最初はトップ（まとめと、見る画面の選択）を出す
  if (typeof initDataHub === "function") initDataHub()
}

