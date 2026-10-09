// ===============================
// ===== データ画面のトップ =========
// ===============================
// データ画面を開いたときに最初に出す画面。全ゲーム（Count-Up・01・Cricket をまとめて）の練習のまとめと、
// 見る画面（History：記録 / Stats：分析）のカード・練習した日のカレンダー・選んだ日のメモとゲームを出す。
// ゲームの種類はトップでは分けない（Stats の画面のヘッダーで選ぶ）。
// 各画面ではヘッダーの「‹ Top」でこの画面に戻る。body に data-hub-open を付けている間は、ふつうの表示（main）を隠す

let dataHubOpen = false

// 見る画面のカード（2026.10.10 から「記録」と「分析」の 2 つ。もとの Analysis は Count-Up の Stats にまとめた）
const DATA_HUB_VIEWS = {
  history: { title: "History", desc: "全ゲームの記録を新しい順に。ゲームの種類で絞り込めます", icon: "list" },
  stats: { title: "Stats", desc: "ゲームの種類ごとの成績・推移・レーティング。Count-Up はヒートマップ・タグ別の散布図・期間の比較も", icon: "chart" }
}

function getDataHubIcon(name) {
  const icons = {
    list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1.2"/><circle cx="4" cy="12" r="1.2"/><circle cx="4" cy="18" r="1.2"/>',
    chart: '<path d="M3 20h18"/><path d="M4 16l5-5 4 3 7-8"/><circle cx="9" cy="11" r="1.2"/><circle cx="13" cy="14" r="1.2"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'
  }
  return `<svg class="data-hub-icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || ""}</svg>`
}

function formatDataHubDate(time) {
  if (!time) return "-"
  const date = new Date(time)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

// 全ゲーム（History と同じもの。古い順）
function getDataHubSessions() {
  return typeof readHistorySessions === "function" ? readHistorySessions() : readDataSessions()
}

// 練習のまとめ（[ラベル, 狭い画面のラベル, 値] の配列。ゲームの種類に関係なく数える。トップのときだけヘッダーの右に出す）
function getDataHubSummary(sessions) {
  const now = new Date()
  const days = new Set(sessions.map(s => getDataHubDayKey(s.date)))
  const thisMonth = sessions.filter(s => {
    const d = new Date(s.date)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  return [
    ["Games", "Games", sessions.length],
    ["Days", "Days", days.size],
    ["This Month", "Month", thisMonth.length],
    ["Last Played", "Last", formatDataHubDate(sessions.length ? sessions[sessions.length - 1].date : 0)]
  ]
}

// ゲームの種類ごとの数（History のカードの下に出す）
function getDataHubTypeCounts(sessions) {
  const counts = { countup: 0, "01": 0, cricket: 0 }
  sessions.forEach(s => {
    const type = getHistoryGameType(s)
    if (type) counts[type]++
  })
  return Object.keys(counts)
    .map(type => `${HISTORY_GAME_LABELS[type]} ${counts[type]}`)
    .join(" · ")
}

function renderDataHub() {

  const hub = document.getElementById("dataHub")
  if (!hub) return

  const sessions = getDataHubSessions()

  // 日付を選んでいなければ、最後に練習した日を選んでおく（その日のメモとゲームを出す）
  if (!dataHubSelectedDay && sessions.length) {
    dataHubSelectedDay = getDataHubDayKey(sessions[sessions.length - 1].date)
  }

  const statsType = typeof dataGameType === "string" ? dataGameType : "countup"
  const cards = [
    { mode: "history", ...DATA_HUB_VIEWS.history, count: `${sessions.length} games`, note: getDataHubTypeCounts(sessions) },
    // Stats は前回見ていたゲームから開く
    { mode: "stats", ...DATA_HUB_VIEWS.stats, count: HISTORY_GAME_LABELS[statsType] }
  ]

  const headerStats = document.getElementById("dataHubHeaderStats")
  if (headerStats) {
    headerStats.innerHTML = getDataHubSummary(sessions).map(([label, short, value]) => `
      <div class="data-hub-head-stat" title="${label}">
        <span class="data-hub-head-label"><span class="long">${label}</span><span class="short">${short}</span></span>
        <span class="data-hub-head-value">${value}</span>
      </div>
    `).join("")
  }

  // 描き直しても左右のスクロール位置は保つ（日付を変えたときは右を上に戻す：dataHubResetMainScroll）
  const prevSide = document.getElementById("dataHubSide")
  const prevMain = document.getElementById("dataHubMain")
  const sideScroll = prevSide ? prevSide.scrollTop : 0
  const mainScroll = prevMain && !dataHubResetMainScroll ? prevMain.scrollTop : 0
  dataHubResetMainScroll = false

  // 横向き（とパソコン）は左右 2 列：左に History / Stats のカードとカレンダー（右とは別にスクロール）、
  // 右に選んだ日のメモとゲーム（ここだけスクロール）。縦向きは上から順に並べて画面ごとスクロール
  hub.innerHTML = `
    <div class="data-hub-layout">
    <div class="data-hub-side" id="dataHubSide">
    <section class="data-hub-views">
      ${cards.map(card => `
        <button type="button" class="data-hub-card${card.mode === "history" ? " primary" : ""}" data-hub-view="${card.mode}">
          <span class="data-hub-card-top">
            ${getDataHubIcon(card.icon)}
            <span class="data-hub-card-count">${card.count}</span>
          </span>
          <span class="data-hub-card-title">${card.title}</span>
          <span class="data-hub-card-desc">${card.desc}</span>
          ${card.note ? `<span class="data-hub-card-note">${card.note}</span>` : ""}
        </button>
      `).join("")}
    </section>

    ${renderDataHubCalendar(sessions)}
    ${renderDataHubPeriod(sessions)}

    ${sessions.length ? "" : '<p class="data-hub-note">まだ記録がありません。ゲームを終えると、ここに練習の記録が出ます。</p>'}
    </div>
    <div class="data-hub-main" id="dataHubMain">
      ${dataHubSelectedDay ? renderDataHubDay(sessions) : ""}
    </div>
    </div>
  `

  document.getElementById("dataHubSide").scrollTop = sideScroll
  document.getElementById("dataHubMain").scrollTop = mainScroll

  hub.querySelectorAll("[data-hub-view]").forEach(btn => {
    btn.addEventListener("click", () => openDataView(btn.dataset.hubView))
  })

  // 選んだ日のゲーム（History と同じ履歴カード。押すと開く）
  if (dataHubSelectedDay) fillDataHubDay(sessions)

  hub.querySelectorAll("[data-hub-day]").forEach(btn => {
    btn.addEventListener("click", () => {
      dataHubResetMainScroll = true
      dataHubSelectedDay = btn.dataset.hubDay
      renderDataHub()
      // 縦に並んでいるとき（スマホ縦など）は、出したゲームの一覧が見えるところまで送る
      const list = document.getElementById("dataHubDay")
      if (list && isDataHubStacked()) list.scrollIntoView({ block: "start", behavior: "smooth" })
    })
  })

  const photo = hub.querySelector("[data-hub-image] img")
  if (photo) photo.parentElement.addEventListener("click", () => openDataHubImage(photo.src))

  const memo = hub.querySelector("[data-hub-day-memo]")
  if (memo) memo.addEventListener("click", () => openDayNoteEditor(dataHubSelectedDay, memo.dataset.label))

  hub.querySelectorAll("[data-hub-period]").forEach(btn => {
    btn.addEventListener("click", () => {
      dataHubPeriodMode = btn.dataset.hubPeriod
      try { localStorage.setItem(DATA_HUB_PERIOD_KEY, dataHubPeriodMode) } catch {}
      renderDataHub()
    })
  })

  hub.querySelectorAll("[data-hub-month]").forEach(btn => {
    btn.addEventListener("click", () => {
      dataHubCalendarMonth = new Date(dataHubCalendarMonth.getFullYear(), dataHubCalendarMonth.getMonth() + Number(btn.dataset.hubMonth), 1)
      renderDataHub()
    })
  })
}


// ===============================
// ===== カレンダー ================
// ===============================
// 練習した日（全ゲーム）に印を付ける（その日のゲーム数を小さく出す）。‹ › で月を切り替える。
// 練習した日を押すと、その日のメモとゲーム（履歴カード）を横（縦向きは下）に出す。最初は最後に練習した日を選んでおく
// メモ・タグは Memo ボタンで編集できる（タグは Count-Up の Stats のタグ別散布図の色分けに使う）。メモのある日はカレンダーに印
let dataHubCalendarMonth = null
// カレンダーで選んだ日（"YYYY-MM-DD"）
let dataHubSelectedDay = null
// 次に描くとき、右（選んだ日のメモとゲーム）のスクロールを上に戻す
let dataHubResetMainScroll = false

// 縦に 1 列で並べているか（縦向きのタブレット・スマホ。lay_data.css の .data-hub-layout）
function isDataHubStacked() {
  const cls = document.body.classList
  return !cls.contains("landscape") && !cls.contains("desktop")
}

function getDataHubDayKey(time) {
  const d = new Date(time)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// 選んだ日のゲームの一覧（中身は fillDataHubDay() で入れる）
function renderDataHubDay(all) {
  const sessions = all.filter(s => getDataHubDayKey(s.date) === dataHubSelectedDay)
  const [, m, d] = dataHubSelectedDay.split("-").map(Number)
  return `
    <section class="data-hub-recent data-hub-day" id="dataHubDay">
      <div class="data-hub-day-top">
        <h3 class="data-hub-section-title">${m}/${d} Games（${sessions.length}）</h3>
      </div>
      ${renderDataHubDayNote(m, d)}
      ${renderDataHubDayRates(sessions)}
      <div id="dataHubDayList" class="data-hub-day-list"></div>
    </section>
  `
}

// 選んだ日のメモ（コメント・タグ・画像の有無）と、編集画面を開く Memo ボタン（編集画面は data_notes.js の openDayNoteEditor()）
function renderDataHubDayNote(m, d) {
  const note = getDayNote(dataHubSelectedDay)
  const tags = note.tags || []
  const has = note.comment || tags.length || note.imageData
  const body = has
    ? `
      ${note.comment ? `<p class="data-hub-note-text">${escapeHtml(note.comment)}</p>` : ""}
      ${tags.length ? `<div class="group-note-chip-row">
        ${tags.map(tag => `<span class="group-note-chip">#${escapeHtml(tag)}</span>`).join("")}
      </div>` : ""}
    `
    : '<p class="data-hub-note-empty">メモ・タグはまだありません</p>'
  // セッティングの写真は小さく出し、押すと大きく見せる（openDataHubImage()）
  const image = note.imageData
    ? `<button type="button" class="data-hub-note-image" data-hub-image aria-label="写真を大きく見る"><img src="${note.imageData}" alt="${m}/${d} のセッティングの写真"></button>`
    : ""
  return `
    <div class="data-hub-day-note">
      ${image}
      <div class="data-hub-day-note-body">${body}</div>
      <button type="button" class="group-note-edit-btn" data-hub-day-memo data-label="${m}/${d}">${has ? "Memo" : "+ Memo"}</button>
    </div>
  `
}

// その日の Bull / In-Bull / Triple の割合（全ゲームの投数に対して）。
// 1 投ごとの記録（darts）があればそこから数え、ない古い記録はゲームのブル数・トリプル数と投数（ラウンド数 × 3）で数える
function getDataHubDayHitCounts(session) {
  if (Array.isArray(session.darts) && session.darts.length && typeof getZeroOneHitCounts === "function") {
    return getZeroOneHitCounts(session)
  }
  const rounds = Array.isArray(session.roundScores) ? session.roundScores.length : 0
  const triples = session.tripleHits ? Object.values(session.tripleHits).reduce((a, b) => a + (Number(b) || 0), 0) : 0
  return {
    darts: rounds * 3,
    bulls: Number(session.bulls) || 0,
    inner: Number(session.innerBulls) || 0,
    triples
  }
}

function renderDataHubDayRates(daySessions) {
  const total = daySessions.reduce((sum, session) => {
    const c = getDataHubDayHitCounts(session)
    Object.keys(sum).forEach(key => { sum[key] += c[key] || 0 })
    return sum
  }, { darts: 0, bulls: 0, inner: 0, triples: 0 })
  if (!total.darts) return ""

  const item = (label, count, cls) => {
    const rate = count / total.darts * 100
    return `
      <div class="data-hub-rate ${cls}">
        <span class="data-hub-rate-head"><span>${label}</span><strong>${rate.toFixed(1)}%</strong></span>
        <span class="data-hub-rate-bar"><i style="width:${Math.min(100, rate).toFixed(1)}%"></i></span>
        <small>${count} / ${total.darts}</small>
      </div>
    `
  }
  return `
    <div class="data-hub-rates">
      ${item("Bull", total.bulls, "bull")}
      ${item("In-Bull", total.inner, "inner")}
      ${item("Triple", total.triples, "triple")}
    </div>
  `
}

// 写真を画面いっぱいに出す（押すか Esc で閉じる）
function openDataHubImage(src) {
  const viewer = document.createElement("div")
  viewer.className = "image-viewer"
  viewer.setAttribute("role", "dialog")
  viewer.setAttribute("aria-label", "写真")
  viewer.innerHTML = `<img src="${src}" alt="">`
  const close = () => {
    viewer.remove()
    document.removeEventListener("keydown", onKey)
  }
  const onKey = e => { if (e.key === "Escape") close() }
  viewer.addEventListener("click", close)
  document.addEventListener("keydown", onKey)
  document.body.appendChild(viewer)
}

// 選んだ日のゲームを、History と同じ履歴カードで出す（見出しにゲームの種類の印。番号はゲームごとの通し番号。新しい順）
function fillDataHubDay(all) {

  const box = document.getElementById("dataHubDayList")
  if (!box) return

  const counters = {}
  all
    .map(session => {
      const type = getHistoryGameType(session)
      counters[type] = (counters[type] || 0) + 1
      return { session, type, number: counters[type] }
    })
    .filter(item => getDataHubDayKey(item.session.date) === dataHubSelectedDay)
    .reverse()
    .forEach(item => box.appendChild(createHistoryCardElement(item.session, item.type, item.number)))
}

function renderDataHubCalendar(sessions) {

  // 最初は最後に遊んだ月（記録がなければ今月）
  if (!dataHubCalendarMonth) {
    const base = sessions.length ? new Date(sessions[sessions.length - 1].date) : new Date()
    dataHubCalendarMonth = new Date(base.getFullYear(), base.getMonth(), 1)
  }

  const notes = getAllDayNotes()
  const year = dataHubCalendarMonth.getFullYear()
  const month = dataHubCalendarMonth.getMonth()

  const counts = {}
  sessions.forEach(session => {
    const d = new Date(session.date)
    if (d.getFullYear() !== year || d.getMonth() !== month) return
    counts[d.getDate()] = (counts[d.getDate()] || 0) + 1
  })
  const days = Object.keys(counts).length
  const games = Object.values(counts).reduce((a, b) => a + b, 0)

  const today = new Date()
  const isThisMonth = today.getFullYear() === year && today.getMonth() === month

  // 月曜はじまり
  const offset = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  let cells = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(d => `<span class="data-hub-cal-head">${d}</span>`).join("")
  cells += '<span class="data-hub-cal-day empty"></span>'.repeat(offset)
  for (let d = 1; d <= daysInMonth; d++) {
    const count = counts[d] || 0
    const cls = ["data-hub-cal-day"]
    if (count) cls.push("played")
    if (count >= 5) cls.push("many")
    if (isThisMonth && today.getDate() === d) cls.push("today")
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    if (key === dataHubSelectedDay) cls.push("selected")
    // メモ・タグのある日は右上に小さな印
    const note = notes[key]
    if (note && (note.comment || (note.tags || []).length || note.imageData)) cls.push("has-note")
    const inner = `<span class="data-hub-cal-num">${d}</span>` +
      `${count ? `<span class="data-hub-cal-count">${count}</span>` : ""}`
    // 練習した日は押すとその日のゲームを出す
    cells += count
      ? `<button type="button" class="${cls.join(" ")}" data-hub-day="${key}" aria-label="${month + 1}/${d} ${count} games">${inner}</button>`
      : `<span class="${cls.join(" ")}">${inner}</span>`
  }

  return `
    <section class="data-hub-calendar">
      <div class="data-hub-cal-top">
        <h3 class="data-hub-section-title">Calendar</h3>
        <span class="data-hub-cal-nav">
          <button type="button" data-hub-month="-1" aria-label="前の月">‹</button>
          <span class="data-hub-cal-title">${year}/${month + 1}</span>
          <button type="button" data-hub-month="1" aria-label="次の月">›</button>
        </span>
      </div>
      <div class="data-hub-cal-grid">${cells}</div>
      <p class="data-hub-cal-sum">${days} days · ${games} games</p>
    </section>
  `
}

function setDataHubOpen(open) {
  dataHubOpen = open
  document.body.classList.toggle("data-hub-open", open)
  // トップではゲームの切り替え（Stats 用）もページ送り（History 用）も出さない
  if (open) document.body.classList.remove("data-history-view", "data-stats-view")
  // 左上のボタン：トップでは「‹ Menu」（メインメニューへ）、各画面では「‹ Top」（データのトップへ）
  const back = document.getElementById("dataHubBack")
  if (back) back.textContent = open ? "‹ Menu" : "‹ Top"
}

// 各画面を開くと履歴を 1 つ足し、端末・ブラウザの「戻る」でトップに戻れるようにする
let dataHubPopstateBound = false

function isDataViewHistoryState() {
  return Boolean(window.history && window.history.state && window.history.state.dataView)
}

function bindDataHubPopstate() {
  if (dataHubPopstateBound) return
  dataHubPopstateBound = true
  window.addEventListener("popstate", () => {
    if (!isDataViewHistoryState() && !dataHubOpen) showDataHub()
  })
}

// ヘッダーの「‹ Top」：開いた画面の履歴があれば戻る（popstate でトップを出す）。なければ直接トップを出す
function backToDataHub() {
  const state = window.history && window.history.state
  if (state && state.dataView) {
    window.history.back()
    return
  }
  if (window.history && typeof window.history.replaceState === "function") window.history.replaceState({}, "")
  showDataHub()
}

function showDataHub() {
  setDataHubOpen(true)
  renderDataHub()
  const hub = document.getElementById("dataHub")
  if (hub) hub.scrollTop = 0
}

// 選んだ画面を開く（"history" / "stats"）
function openDataView(mode) {

  setDataHubOpen(false)

  // History（全ゲームの一覧）は開くたびに 1 ページ目から
  if (typeof currentPage !== "undefined") currentPage = 1

  if (window.history && typeof window.history.pushState === "function" && !isDataViewHistoryState()) {
    window.history.pushState({ dataView: mode }, "")
  }

  changeView(mode)

  requestAnimationFrame(() => {
    if (typeof redrawVisibleCharts === "function") redrawVisibleCharts()
  })
}

function initDataHub() {
  // トップの履歴カード（選んだ日のゲーム）も、押すと開く（data_loader.js の toggleSessionCard()）
  const hub = document.getElementById("dataHub")
  if (hub && !hub.dataset.ready) {
    hub.dataset.ready = "1"
    hub.addEventListener("click", e => {
      const card = e.target instanceof Element ? e.target.closest(".session-card") : null
      if (card && hub.contains(card)) toggleSessionCard(card)
    })
  }

  const back = document.getElementById("dataHubBack")
  if (back && !back.dataset.ready) {
    back.dataset.ready = "1"
    back.addEventListener("click", () => {
      if (dataHubOpen) location.href = "index.html"
      else backToDataHub()
    })
  }
  bindDataHubPopstate()
  showDataHub()
}


// ===============================
// ===== 週・月・年の練習量 ========
// ===============================
// カレンダーの下に、今週（月曜はじまり）・今月・今年の練習量（練習した日数・ゲーム数・ゲームの種類ごとの数）を出し、
// 前の期間の練習量も小さく添える。成績（平均や差）は出さない（成績の推移は Stats の Period：data_period.js）
const DATA_HUB_PERIOD_KEY = "dartsDataHubPeriod"

let dataHubPeriodMode = (() => {
  try {
    const saved = localStorage.getItem(DATA_HUB_PERIOD_KEY)
    return PERIOD_LABELS[saved] ? saved : "week"
  } catch {
    return "week"
  }
})()

function getDataHubActivity(sessions, range) {
  const list = getSessionsInPeriod(sessions, range)
  const counts = { countup: 0, "01": 0, cricket: 0 }
  list.forEach(s => {
    const type = getHistoryGameType(s)
    if (type) counts[type]++
  })
  return { games: list.length, days: new Set(list.map(s => getDataHubDayKey(s.date))).size, counts }
}

function renderDataHubPeriod(sessions) {

  if (!sessions.length) return ""

  const mode = dataHubPeriodMode
  const now = new Date()
  const range = getPeriodRange(now, mode)
  const prevRange = getPeriodRange(now, mode, -1)
  const cur = getDataHubActivity(sessions, range)
  const prev = getDataHubActivity(sessions, prevRange)

  const types = Object.keys(cur.counts)
    .filter(type => cur.counts[type])
    .map(type => `<span class="data-hub-practice-type history-${type === "01" ? "zeroone" : type}"><span class="history-game-badge">${HISTORY_GAME_LABELS[type]}</span>${cur.counts[type]}</span>`)
    .join("")

  return `
    <section class="data-hub-period">
      <div class="data-hub-period-top">
        <h3 class="data-hub-section-title">Practice</h3>
        <span class="data-hub-period-tabs" role="group" aria-label="期間">
          ${Object.keys(PERIOD_LABELS).map(key => `
            <button type="button" data-hub-period="${key}" class="${key === mode ? "active" : ""}" aria-pressed="${key === mode}">${PERIOD_LABELS[key]}</button>
          `).join("")}
        </span>
      </div>
      <div class="data-hub-practice">
        <div class="data-hub-practice-main">
          <small>${PERIOD_NOW_LABELS[mode]} · ${formatPeriodLabel(range, mode)}</small>
          <span><strong>${cur.days}</strong> days <strong>${cur.games}</strong> games</span>
        </div>
        <div class="data-hub-practice-prev">
          <small>${PERIOD_PREV_LABELS[mode]}</small>
          <span>${prev.days} days · ${prev.games} games</span>
        </div>
      </div>
      ${types ? `<div class="data-hub-practice-types">${types}</div>` : ""}
    </section>
  `
}
