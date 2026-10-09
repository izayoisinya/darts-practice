// ===============================
// ===== データ画面のトップ =========
// ===============================
// データ画面を開いたときに最初に出す画面。選んでいるゲーム（Count-Up / 01 / Cricket）の成績のまとめと、
// 見る画面（Games・Analysis）のカード・練習した日のカレンダー・最近のゲームを出し、選んだ画面を開く。
// 各画面ではヘッダーの「‹ Top」でこの画面に戻る。body に data-hub-open を付けている間は、ふつうの表示（main）を隠す

let dataHubOpen = false

// 見る画面のカード（Count-Up。表示・非表示は設定画面の Data Tabs に従う：data.js の getVisibleViews()。
// 今は Games と Analysis だけ。Day / Week / Month / Year は一旦お休みで、日付はトップのカレンダーで見る）
const DATA_HUB_VIEWS = {
  game: { title: "Games", desc: "1 ゲームずつの記録・スコアの推移・全体の Stats・レーティング", icon: "list" },
  analysis: { title: "Analysis", desc: "ヒートマップ・RANGE・タグ別の散布図・期間の比較", icon: "target" },
  day: { title: "Day", desc: "日ごとのまとめ・メモとタグ・カレンダー", icon: "calendar" },
  week: { title: "Week", desc: "週ごとのまとめ", icon: "calendar" },
  month: { title: "Month", desc: "月ごとのまとめ", icon: "calendar" },
  year: { title: "Year", desc: "年ごとのまとめ", icon: "calendar" }
}

// 01・クリケットは Games の画面だけ
const DATA_HUB_GAME_DESC = {
  "01": "上がり率・上がるまでのダーツ数・RANGE・レーティング・1 ゲームずつの記録",
  cricket: "MPR・クローズ率・数字ごとのマーク・レーティング・1 ゲームずつの記録"
}

function getDataHubIcon(name) {
  const icons = {
    list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1.2"/><circle cx="4" cy="12" r="1.2"/><circle cx="4" cy="18" r="1.2"/>',
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

// ゲームごとの成績のまとめ（[ラベル, 値] の配列）
function getDataHubSummary(type) {

  const average = list => list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0

  if (type === "01") {
    const list = typeof readZeroOneSessions === "function" ? readZeroOneSessions() : []
    const finished = list.filter(s => s.zeroOne.finished)
    const darts = finished.map(s => s.zeroOne.finishDarts).filter(n => n > 0)
    return {
      count: list.length,
      items: [
        ["Games", list.length],
        ["Finish Rate", list.length ? `${Math.round(finished.length / list.length * 100)}%` : "-"],
        ["Avg Darts", darts.length ? average(darts).toFixed(1) : "-"],
        ["Best Darts", darts.length ? Math.min(...darts) : "-"],
        ["Last Played", formatDataHubDate(list.length ? list[list.length - 1].date : 0)]
      ]
    }
  }

  if (type === "cricket") {
    const list = typeof readCricketSessions === "function" ? readCricketSessions() : []
    const mprs = list.map(s => s.cricket.mpr)
    return {
      count: list.length,
      items: [
        ["Games", list.length],
        ["Avg MPR", list.length ? average(mprs).toFixed(2) : "-"],
        ["Best MPR", list.length ? Math.max(...mprs).toFixed(2) : "-"],
        ["Close Rate", list.length ? `${Math.round(list.filter(s => s.cricket.finished).length / list.length * 100)}%` : "-"],
        ["Last Played", formatDataHubDate(list.length ? list[list.length - 1].date : 0)]
      ]
    }
  }

  const list = readDataSessions()
  const scores = list.map(s => Number(s.score) || 0)
  return {
    count: list.length,
    items: [
      ["Games", list.length],
      ["Avg Score", list.length ? average(scores).toFixed(1) : "-"],
      ["Avg PPD", list.length ? average(list.map(s => Number(s.ppd) || 0)).toFixed(2) : "-"],
      ["Best Score", list.length ? Math.max(...scores) : "-"],
      ["Last Played", formatDataHubDate(list.length ? list[list.length - 1].date : 0)]
    ]
  }
}

// カードの右上に出す件数（ゲーム数・日数など。1 のときは単数）
function formatDataHubCount(count, unit) {
  return `${count} ${unit}${count === 1 ? "" : "s"}`
}

function getDataHubCount(mode, sessions) {
  if (mode === "game") return formatDataHubCount(sessions.length, "game")
  if (mode === "analysis") {
    const hits = sessions.reduce((sum, s) => sum + (s.darts || []).filter(d => d && d.pos).length, 0)
    return formatDataHubCount(hits, "hit")
  }
  return formatDataHubCount(Object.keys(groupSessions(sessions, mode)).length, mode)
}

// 最近のゲーム（新しい順に 5 つ。[日時, 設定などの説明, 主な数字, 数字の種類]）
const DATA_HUB_RECENT = 5

function getDataHubRecent(type) {

  const time = value => {
    const d = new Date(value)
    const pad = n => String(n).padStart(2, "0")
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  if (type === "01") {
    return (typeof readZeroOneSessions === "function" ? readZeroOneSessions() : [])
      .slice(-DATA_HUB_RECENT).reverse()
      .map(s => [
        time(s.date),
        typeof formatZeroOneConfigKey === "function" ? formatZeroOneConfigKey(getZeroOneConfigKey(s.zeroOne)) : "",
        s.zeroOne.finished ? s.zeroOne.finishDarts : s.zeroOne.remaining,
        s.zeroOne.finished ? "darts" : "left"
      ])
  }

  if (type === "cricket") {
    return (typeof readCricketSessions === "function" ? readCricketSessions() : [])
      .slice(-DATA_HUB_RECENT).reverse()
      .map(s => [
        time(s.date),
        `R${s.cricket.rounds} · ${s.cricket.finished ? `closed ${s.cricket.finishDarts} darts` : "not closed"}`,
        s.cricket.mpr.toFixed(2),
        "MPR"
      ])
  }

  return readDataSessions()
    .slice(-DATA_HUB_RECENT).reverse()
    .map(s => [time(s.date), `PPD ${Number(s.ppd || 0).toFixed(2)}`, s.score, "score"])
}

function renderDataHub() {

  const hub = document.getElementById("dataHub")
  if (!hub) return

  const type = typeof dataGameType === "string" ? dataGameType : "countup"
  const summary = getDataHubSummary(type)

  let cards
  if (type === "countup") {
    const sessions = readDataSessions()
    const views = typeof getVisibleViews === "function" ? getVisibleViews() : Object.keys(DATA_HUB_VIEWS)
    cards = views
      .filter(mode => DATA_HUB_VIEWS[mode])
      .map(mode => ({ mode, ...DATA_HUB_VIEWS[mode], count: getDataHubCount(mode, sessions) }))
  } else {
    cards = [{ mode: "game", ...DATA_HUB_VIEWS.game, desc: DATA_HUB_GAME_DESC[type], count: `${summary.count} games` }]
  }

  hub.innerHTML = `
    <section class="data-hub-summary" aria-label="まとめ">
      ${summary.items.map(([label, value]) => `
        <div class="data-hub-stat">
          <span class="data-hub-stat-label">${label}</span>
          <span class="data-hub-stat-value">${value}</span>
        </div>
      `).join("")}
    </section>

    <section class="data-hub-views">
      ${cards.map(card => `
        <button type="button" class="data-hub-card${card.mode === "game" ? " primary" : ""}" data-hub-view="${card.mode}">
          <span class="data-hub-card-top">
            ${getDataHubIcon(card.icon)}
            <span class="data-hub-card-count">${card.count}</span>
          </span>
          <span class="data-hub-card-title">${card.title}</span>
          <span class="data-hub-card-desc">${card.desc}</span>
        </button>
      `).join("")}
    </section>

    <div class="data-hub-bottom">
      ${renderDataHubCalendar(type)}
      ${dataHubSelectedDay ? renderDataHubDay(type) : renderDataHubRecent(type)}
    </div>

    ${type === "countup" ? "" : '<p class="data-hub-note">Analysis は、今は Count-Up の記録だけを集計しています。</p>'}
    ${summary.count ? "" : '<p class="data-hub-note">まだ記録がありません。ゲームを終えると、ここに成績が出ます。</p>'}
  `

  hub.querySelectorAll("[data-hub-view]").forEach(btn => {
    btn.addEventListener("click", () => openDataView(btn.dataset.hubView))
  })

  // 選んだ日のゲーム（Games 画面と同じ履歴カード。押すと開く）
  if (dataHubSelectedDay) fillDataHubDay(type)

  hub.querySelectorAll("[data-hub-day]").forEach(btn => {
    btn.addEventListener("click", () => {
      dataHubSelectedDay = dataHubSelectedDay === btn.dataset.hubDay ? null : btn.dataset.hubDay
      renderDataHub()
      // 縦に並んでいるとき（スマホ縦など）は、出したゲームの一覧が見えるところまで送る
      const list = document.getElementById("dataHubDay")
      if (list && !document.body.classList.contains("landscape")) list.scrollIntoView({ block: "start", behavior: "smooth" })
    })
  })

  const close = hub.querySelector("[data-hub-day-close]")
  if (close) {
    close.addEventListener("click", () => {
      dataHubSelectedDay = null
      renderDataHub()
    })
  }

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
// 選んでいるゲームを練習した日に印を付ける（その日のゲーム数を小さく出す）。‹ › で月を切り替える。
// 練習した日を押すと、Recent Games の代わりにその日のゲーム（履歴カード）を出す。もう一度押すか Recent で戻す
let dataHubCalendarMonth = null
// カレンダーで選んだ日（"YYYY-MM-DD"）。選んでいる間は Recent Games の代わりにその日のゲームを出す
let dataHubSelectedDay = null

function getDataHubDayKey(time) {
  const d = new Date(time)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// 選んだ日のゲームの一覧（中身は fillDataHubDay() で入れる）
function renderDataHubDay(type) {
  const sessions = getDataHubSessions(type).filter(s => getDataHubDayKey(s.date) === dataHubSelectedDay)
  const [, m, d] = dataHubSelectedDay.split("-").map(Number)
  return `
    <section class="data-hub-recent data-hub-day" id="dataHubDay">
      <div class="data-hub-day-top">
        <h3 class="data-hub-section-title">${m}/${d} Games（${sessions.length}）</h3>
        <button type="button" class="data-hub-day-close" data-hub-day-close>Recent</button>
      </div>
      <div id="dataHubDayList" class="data-hub-day-list"></div>
    </section>
  `
}

// 選んだ日のゲームを、Games 画面と同じ履歴カードで出す（Game の番号は全体の通し番号。新しい順）
function fillDataHubDay(type) {

  const box = document.getElementById("dataHubDayList")
  if (!box) return

  const all = getDataHubSessions(type)
  const createHtml = type === "01"
    ? createZeroOneCardHtml
    : type === "cricket" ? createCricketCardHtml : createSessionCardHtml

  all
    .map((session, index) => ({ session, number: index + 1 }))
    .filter(item => getDataHubDayKey(item.session.date) === dataHubSelectedDay)
    .reverse()
    .forEach(item => box.appendChild(createSessionCardElement(createHtml(item.session, item.number))))
}

function getDataHubSessions(type) {
  if (type === "01") return typeof readZeroOneSessions === "function" ? readZeroOneSessions() : []
  if (type === "cricket") return typeof readCricketSessions === "function" ? readCricketSessions() : []
  return readDataSessions()
}

function renderDataHubCalendar(type) {

  const sessions = getDataHubSessions(type)

  // 最初は最後に遊んだ月（記録がなければ今月）
  if (!dataHubCalendarMonth) {
    const base = sessions.length ? new Date(sessions[sessions.length - 1].date) : new Date()
    dataHubCalendarMonth = new Date(base.getFullYear(), base.getMonth(), 1)
  }

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

function renderDataHubRecent(type) {

  const rows = getDataHubRecent(type)
  if (!rows.length) return ""

  return `
    <section class="data-hub-recent">
      <h3 class="data-hub-section-title">Recent Games</h3>
      <div class="data-hub-recent-list">
        ${rows.map(([when, desc, value, unit]) => `
          <button type="button" class="data-hub-recent-row" data-hub-view="game">
            <span class="data-hub-recent-time">${when}</span>
            <span class="data-hub-recent-desc">${desc}</span>
            <span class="data-hub-recent-value">${value}<small>${unit}</small></span>
          </button>
        `).join("")}
      </div>
    </section>
  `
}

function setDataHubOpen(open) {
  dataHubOpen = open
  document.body.classList.toggle("data-hub-open", open)
  // 左上のボタン：トップでは「‹ Menu」（メインメニューへ）、各画面では「‹ Top」（データのトップへ）
  const back = document.getElementById("dataHubBack")
  if (back) back.textContent = open ? "‹ Menu" : "‹ Top"
}

// 各画面を開くと履歴を 1 つ足し、端末・ブラウザの「戻る」でトップに戻れるようにする
// （Day の詳細ビューは data_detail.js が同じ履歴の上にもう 1 つ足して、戻るで詳細を閉じる）
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

// ヘッダーの「‹ Top」：開いた画面の履歴があれば戻る（popstate でトップを出す）。詳細ビューを開いているときなどは直接トップを出す
function backToDataHub() {
  const state = window.history && window.history.state
  if (state && state.dataView && !state.dataDetailOpen) {
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

// 選んだ画面を開く（01・クリケットは Games の画面だけ）
function openDataView(mode) {

  setDataHubOpen(false)

  // History（全ゲームの一覧）は開くたびに 1 ページ目から
  if (typeof currentPage !== "undefined") currentPage = 1

  if (window.history && typeof window.history.pushState === "function" && !isDataViewHistoryState()) {
    window.history.pushState({ dataView: mode }, "")
  }

  if (dataGameType === "countup") {
    changeView(mode)
  } else {
    // 01・クリケットの表示は隠れている間に描いたグラフの大きさが 0 になっているので描き直す
    setDataGameType(dataGameType)
  }

  // 縦向き（1 パネル表示）は、Games は History から、Analysis は Stats（1 列）を出す
  if (typeof isPhonePortraitDataView === "function" && isPhonePortraitDataView() && typeof setDataPanel === "function") {
    setDataPanel(mode === "analysis" ? "stats" : "history")
  }

  requestAnimationFrame(() => {
    if (typeof redrawVisibleCharts === "function") redrawVisibleCharts()
  })
}

// ヘッダーのゲームの切り替え：トップを出しているときは、トップの中身だけ描き直す
const setDataGameTypeForViews = typeof setDataGameType === "function" ? setDataGameType : null
window.setDataGameType = function (type) {
  if (dataHubOpen && type !== dataGameType) dataHubSelectedDay = null
  if (setDataGameTypeForViews) setDataGameTypeForViews(type)
  if (dataHubOpen) renderDataHub()
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
