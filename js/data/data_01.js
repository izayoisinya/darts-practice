// ===============================
// ===== データ画面の 01 ===========
// ===============================
// ヘッダーの COUNT-UP / 01 の切り替えと、01 の記録の表示（設定ごとの上がり率・上がるまでのダーツ数・推移・一覧）。
// 01 のときは body に data-01 を付け、カウントアップと同じ場所（右の History・左の Stats）に 01 の記録を出す

const DATA_GAME_KEY = "dartsDataGame"
const DATA_01_OUT_LABELS = { open: "Open Out", double: "Double Out", master: "Master Out" }
const DATA_01_CHART_GAMES = 30

let dataGameType = "countup"
let data01ConfigKey = ""

function readZeroOneSessions() {
  return readSessions().filter(session => session && session.gameType === "01" && session.zeroOne)
}

function getZeroOneConfigKey(record) {
  return `${record.start}-${record.out}-${record.rounds}`
}

function formatZeroOneConfigKey(key) {
  const [start, out, rounds] = key.split("-")
  return `${start} · ${DATA_01_OUT_LABELS[out] || out} · R${rounds}`
}

// ===============================
// ===== 切り替え =================
// ===============================
function initDataGameSwitch() {

  const box = document.getElementById("dataGameSwitch")
  if (!box) return
  // initDataPage() が呼び直されても二重に登録しない
  if (box.dataset.ready) {
    setDataGameType(dataGameType)
    return
  }
  box.dataset.ready = "1"

  const buttons = box.querySelectorAll("button")
  buttons.forEach(btn => {
    btn.addEventListener("click", () => setDataGameType(btn.dataset.game))
  })

  // data.html?game=01 なら 01 から。それ以外は前回見ていた方
  let initial = "countup"
  if (/[?&]game=01(&|$)/.test(location.search)) {
    initial = "01"
  } else {
    try {
      initial = localStorage.getItem(DATA_GAME_KEY) === "01" ? "01" : "countup"
    } catch {
      initial = "countup"
    }
  }

  setDataGameType(initial)
}

function setDataGameType(type) {

  dataGameType = type === "01" ? "01" : "countup"

  try {
    localStorage.setItem(DATA_GAME_KEY, dataGameType)
  } catch {
    // 保存できなくても表示はそのまま
  }

  document.body.classList.toggle("data-01", dataGameType === "01")
  document.querySelectorAll("#dataGameSwitch button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.game === dataGameType)
  })

  if (dataGameType === "01") {
    // 01 は Game の表示（左に Stats、右に History）だけ。Analysis や Day などを見ていたら Game に戻してから 01 を描く
    if (typeof changeView === "function" && (viewMode !== "game" || detailViewMode)) changeView("game")
    renderZeroOneData()
  } else if (typeof changeView === "function" && document.getElementById("zeroOneStatsPanel")?.innerHTML) {
    // 01 で上書きした History をカウントアップの表示に戻す
    changeView(viewMode || "game")
  }
}

// 画面の大きさ・向きが変わったら 01 のグラフも描き直す
let data01ResizeTimer = null
window.addEventListener("resize", () => {
  if (dataGameType !== "01") return
  clearTimeout(data01ResizeTimer)
  data01ResizeTimer = setTimeout(() => {
    drawZeroOneChart(getZeroOneFilteredSessions())
  }, 150)
})

// ===============================
// ===== 01 の表示 ================
// ===============================
// カウントアップと同じ場所・同じ部品で出す（レイアウトとデザインをそろえる）
//   右（History）：#sessionsContainer に同じ形のカード（Game n・日時・3 つの数字・開くとラウンドのグラフ）。ページ送りもフッターの Prev / Next
//   左（Stats）  ：#zeroOneStatsPanel に Stats・Awards・グラフ・Rating・Finish Numbers（カウントアップの左の欄は隠す）
let data01Page = 1

function getZeroOneFilteredSessions() {
  const sessions = readZeroOneSessions()
  return data01ConfigKey === "all"
    ? sessions
    : sessions.filter(session => getZeroOneConfigKey(session.zeroOne) === data01ConfigKey)
}

function renderZeroOneData() {

  const panel = document.getElementById("zeroOneStatsPanel")
  const history = document.getElementById("sessionsContainer")
  if (!panel || !history) return

  const sessions = readZeroOneSessions()

  if (!sessions.length) {
    panel.innerHTML = `
      <section class="data-summary-section">
        <h3 class="data-section-title">Stats</h3>
        <p>01 の記録はまだありません。</p>
        <button type="button" class="z1-play" onclick="location.href = 'countup.html?game=01'">01 を始める</button>
      </section>
    `
    history.innerHTML = "<p>No data</p>"
    updateZeroOnePagination(0)
    return
  }

  // 設定ごとにまとめる（新しく遊んだ設定が先）
  const keys = []
  sessions.slice().reverse().forEach(session => {
    const key = getZeroOneConfigKey(session.zeroOne)
    if (!keys.includes(key)) keys.push(key)
  })

  if (data01ConfigKey !== "all" && !keys.includes(data01ConfigKey)) {
    data01ConfigKey = keys[0]
  }

  const list = getZeroOneFilteredSessions()

  const options = [`<option value="all">All Settings（${sessions.length}）</option>`]
    .concat(keys.map(key => {
      const count = sessions.filter(session => getZeroOneConfigKey(session.zeroOne) === key).length
      return `<option value="${key}">${formatZeroOneConfigKey(key)}（${count}）</option>`
    }))
    .join("")

  panel.innerHTML = `
    <div class="z1-filter">
      <select id="z1ConfigSelect" aria-label="01 の設定">${options}</select>
    </div>
    <section class="data-summary-section">
      <h3 class="data-section-title">Stats</h3>
      <div class="z1-stat-cards">${renderZeroOneStatCards(list)}</div>
    </section>
    <section class="data-summary-section">
      <h3 class="data-section-title">Awards</h3>
      <div class="z1-award-cards">${renderZeroOneAwardCards(list)}</div>
    </section>
    ${renderZeroOneHitRates(list)}
    <section class="data-summary-section">
      <h3 class="data-section-title">Darts to Finish (Last ${DATA_01_CHART_GAMES} Games)</h3>
      <canvas id="z1Chart" class="z1-chart"></canvas>
      <div class="z1-legend">
        <span><i class="z1-dot out"></i>上がったダーツ数</span>
        <span><i class="z1-dot fail"></i>上がれなかった</span>
      </div>
    </section>
    ${renderZeroOneRating(list)}
    ${renderZeroOneFinishNumbers(list)}
  `

  const select = document.getElementById("z1ConfigSelect")
  select.value = data01ConfigKey
  select.addEventListener("change", () => {
    data01ConfigKey = select.value
    data01Page = 1
    renderZeroOneData()
  })

  renderZeroOneHistory(list)
  requestAnimationFrame(() => drawZeroOneChart(list))
}

// 1 ゲームの投数・ブル（アウター＋インナー）・インナーブル・トリプルの本数（1 投ごとの記録から）
function getZeroOneHitCounts(session) {
  const counts = { darts: 0, bulls: 0, inner: 0, triples: 0 }
  ;(Array.isArray(session.darts) ? session.darts : []).forEach(dart => {
    if (!dart) return
    counts.darts++
    if (dart.hit === "OB" || dart.hit === "IB") counts.bulls++
    if (dart.hit === "IB") counts.inner++
    if (/^T\d+$/.test(dart.hit)) counts.triples++
  })
  return counts
}

function sumZeroOneHitCounts(list) {
  return list.reduce((total, session) => {
    const counts = getZeroOneHitCounts(session)
    Object.keys(total).forEach(key => { total[key] += counts[key] })
    return total
  }, { darts: 0, bulls: 0, inner: 0, triples: 0 })
}

// ブル・インナーブル・トリプルの本数と割合（全投数に対して）。カウントアップの詳細の Bull Rate と同じ部品
function renderZeroOneHitRates(list) {

  const total = sumZeroOneHitCounts(list)
  if (!total.darts) return ""

  const item = (label, count, extraClass = "") => {
    const rate = count / total.darts * 100
    return `
      <div class="detail-bull-rate-item">
        <div class="detail-bull-rate-head">
          <span class="detail-bull-rate-label">${label}</span>
          <span class="detail-bull-rate-value">${count}（${rate.toFixed(1)}%）</span>
        </div>
        <div class="detail-bull-rate-bar-bg">
          <div class="detail-bull-rate-bar-fill${extraClass}" style="width:${Math.min(100, rate).toFixed(1)}%"></div>
        </div>
      </div>
    `
  }

  return `
    <section class="data-summary-section">
      <h3 class="data-section-title">Bull / Triple（全 ${total.darts} 投）</h3>
      <div class="detail-bull-rate">
        <div class="detail-bull-rate-grid">
          ${item("Bull", total.bulls)}
          ${item("Inner Bull", total.inner, " inner")}
          ${item("Triple", total.triples, " triple")}
        </div>
      </div>
    </section>
  `
}

// カウントアップの Stats と同じ「名前と数字」のカード（.data-card）
function renderZeroOneStatCards(list) {

  const finished = list.filter(session => session.zeroOne.finished)
  const darts = finished.map(session => session.zeroOne.finishDarts).filter(n => n > 0)
  const avgDarts = darts.length ? darts.reduce((a, b) => a + b, 0) / darts.length : 0
  const avgPpd = list.length ? list.reduce((sum, session) => sum + (session.ppd || 0), 0) / list.length : 0
  const recent = list.slice(-10)
  const recentRate = recent.length ? recent.filter(session => session.zeroOne.finished).length / recent.length * 100 : 0

  return [
    ["Games Played", list.length],
    ["Finish Rate", list.length ? `${(finished.length / list.length * 100).toFixed(0)}%` : "-"],
    ["Avg Darts", avgDarts ? avgDarts.toFixed(1) : "-"],
    ["Best Darts", darts.length ? Math.min(...darts) : "-"],
    ["Average PPD", avgPpd.toFixed(2)],
    // 直近 10 ゲームだけで見た上がり率（最近の調子の目安）
    ["Finish Rate (Last 10)", recent.length ? `${recentRate.toFixed(0)}%` : "-"]
  ]
    .map(([title, value]) => `
      <div class="data-card">
        <span class="data-title">${title}</span>
        <span class="data-value">${value}</span>
      </div>
    `)
    .join("")
}

function renderZeroOneAwardCards(list) {

  const totals = {}
  AWARD_LABELS.forEach(([key]) => { totals[key] = 0 })
  list.forEach(session => {
    const awards = getSessionAwards(session)
    AWARD_LABELS.forEach(([key]) => { totals[key] += awards[key] || 0 })
  })

  return AWARD_LABELS
    .map(([key, label]) => `
      <div class="data-card">
        <span class="data-title">${label}</span>
        <span class="data-value">${totals[key]}</span>
      </div>
    `)
    .join("")
}

// History：カウントアップと同じ形のカード（新しい順、PAGE_SIZE ごとにページ送り）
function renderZeroOneHistory(list) {

  const container = document.getElementById("sessionsContainer")
  container.innerHTML = ""

  const reversed = list.slice().reverse()
  const totalPages = Math.max(1, Math.ceil(reversed.length / PAGE_SIZE))
  data01Page = Math.min(Math.max(1, data01Page), totalPages)

  const start = (data01Page - 1) * PAGE_SIZE
  reversed.slice(start, start + PAGE_SIZE).forEach((session, index) => {
    const gameNumber = reversed.length - (start + index)
    container.appendChild(createSessionCardElement(createZeroOneCardHtml(session, gameNumber)))
  })

  updateZeroOnePagination(totalPages)
}

function createZeroOneCardHtml(session, gameNumber) {

  const z = session.zeroOne
  const result = z.finished
    ? `<span class="session-kpi-value z1-out">${z.finishDarts}</span>`
    : `<span class="session-kpi-value z1-fail">${z.remaining}</span>`
  const finishHit = z.finished ? getZeroOneFinishHit(session) : null
  const stats80 = getZeroOneStats80(session)

  const hits = getZeroOneHitCounts(session)
  const rate = count => hits.darts ? (count / hits.darts * 100).toFixed(1) : "0.0"

  const summary = [
    formatZeroOneConfigKey(getZeroOneConfigKey(z)),
    z.finished ? `OUT${finishHit ? ` ${formatZeroOneHit(finishHit)}` : ""}` : "NO OUT",
    `Bull ${hits.bulls}（${rate(hits.bulls)}%）`,
    `T ${hits.triples}（${rate(hits.triples)}%）`
  ].join(" · ")

  const rateRow = (label, count, extraClass = "") => `
    <div class="stat-row session-stat-row">
      <span class="label">${label}</span>
      <span class="count">${count}</span>
      <div class="bar-bg">
        <div class="bar-fill${extraClass}" style="width:${rate(count)}%"></div>
      </div>
      <span class="percent">${rate(count)}%</span>
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
            <span class="session-kpi-label">${z.finished ? "Out Darts" : "Left"}</span>
            ${result}
          </div>
          <div class="session-kpi-item">
            <span class="session-kpi-label">PPD</span>
            <span class="session-kpi-value">${Number(session.ppd || 0).toFixed(2)}</span>
          </div>
          <div class="session-kpi-item">
            <span class="session-kpi-label">80% Stats</span>
            <span class="session-kpi-value">${stats80 !== null ? stats80.toFixed(1) : "-"}</span>
          </div>
        </div>

        <div class="session-compact-summary">${summary}</div>

        <div class="session-rate-group">
          ${rateRow("Bull", hits.bulls)}
          ${rateRow("In", hits.inner, " inner")}
          ${rateRow("T", hits.triples, " triple")}
        </div>

        <div class="session-meta-block session-triple-block">
          <div class="session-meta-title">Triple</div>
          ${createZeroOneTripleHtml(session)}
        </div>
      </div>

      <div class="session-side-block">
        <div class="session-meta-block session-round-block">
          <div class="session-meta-title">Round Scores</div>
          <div class="round-chart">${createRoundChartHtml(session.roundScores || [])}</div>
        </div>
      </div>
    </div>

    <div class="session-meta-block session-awards-block">
      <div class="session-meta-title">Awards</div>
      <div class="session-awards-grid">${createAwardsHtml(session)}</div>
    </div>
  `
}

// 20〜15 のトリプルの本数（カウントアップの履歴カードの Triple と同じ形。1 投ごとの記録から数える）
function createZeroOneTripleHtml(session) {
  const counts = {}
  for (let n = 15; n <= 20; n++) counts[n] = 0
  ;(Array.isArray(session.darts) ? session.darts : []).forEach(dart => {
    const match = dart && /^T(\d+)$/.exec(dart.hit)
    if (match && counts[match[1]] !== undefined) counts[match[1]]++
  })

  return `
    <div class="session-triple-grid">
      ${[20, 19, 18, 17, 16, 15].map(n => `
        <div class="session-triple-item"><span class="session-triple-label">${n}:</span><span class="session-triple-value">${counts[n]}</span></div>
      `).join("")}
    </div>
  `
}

function updateZeroOnePagination(totalPages) {
  const info = document.getElementById("pageInfo")
  const prev = document.getElementById("prevBtn")
  const next = document.getElementById("nextBtn")
  if (info) info.textContent = `${totalPages ? data01Page : 0} / ${totalPages}`
  if (prev) prev.disabled = data01Page <= 1
  if (next) next.disabled = data01Page >= totalPages
}

// パネルの切り替え（スマホ縦の History / Stats）・回転のあとのグラフの描き直しは、01 のときは 01 のグラフを描く
const redrawVisibleChartsForCountUp = typeof redrawVisibleCharts === "function" ? redrawVisibleCharts : null
window.redrawVisibleCharts = function () {
  if (dataGameType === "01") {
    drawZeroOneChart(getZeroOneFilteredSessions())
    return
  }
  if (redrawVisibleChartsForCountUp) redrawVisibleChartsForCountUp()
}

// フッターの Prev / Next は、01 を見ているときは 01 の History のページを送る
const changePageForCountUp = typeof changePage === "function" ? changePage : null
window.changePage = function (direction) {
  if (dataGameType !== "01") {
    if (changePageForCountUp) changePageForCountUp(direction)
    return
  }
  data01Page += direction === "Prev" ? -1 : 1
  renderZeroOneHistory(getZeroOneFilteredSessions())
  const container = document.getElementById("sessionsContainer")
  if (container) container.scrollTop = 0
}

// 上がるまでのダーツ数の推移。上がれなかったゲームは上の段に赤い × で出す
function drawZeroOneChart(list) {

  const canvas = document.getElementById("z1Chart")
  if (!canvas || typeof setupHiDPICanvas !== "function") return

  // 隠れている（スマホ縦で History を見ている）ときは大きさが測れないので、Stats を開いたときに描く（redrawVisibleCharts）
  if (!canvas.offsetWidth) return
  const state = setupHiDPICanvas(canvas, 200)
  if (!state) return

  const { ctx, width, height } = state
  const games = list.slice(-DATA_01_CHART_GAMES)
  const darts = games.filter(session => session.zeroOne.finished).map(session => session.zeroOne.finishDarts)

  const left = 34
  const right = 12
  const top = 22
  const bottom = 20
  const graphWidth = width - left - right
  const graphHeight = height - top - bottom

  // 縦軸は上がったダーツ数の範囲（少し余白を取り、3 本単位に丸める）
  const maxDarts = Math.max(9, ...darts)
  const minDarts = darts.length ? Math.min(...darts) : 0
  const yMax = Math.ceil((maxDarts + 3) / 3) * 3
  const yMin = Math.max(0, Math.floor((minDarts - 3) / 3) * 3)

  const xAt = i => left + (games.length > 1 ? graphWidth * i / (games.length - 1) : graphWidth / 2)
  const yAt = value => top + graphHeight - (value - yMin) / Math.max(1, yMax - yMin) * graphHeight

  ctx.clearRect(0, 0, width, height)

  // 横の目盛り
  ctx.font = "600 10px 'Segoe UI', 'Noto Sans JP', sans-serif"
  ctx.textAlign = "right"
  ctx.textBaseline = "middle"
  const step = Math.max(3, Math.ceil((yMax - yMin) / 4 / 3) * 3)
  for (let v = yMin; v <= yMax; v += step) {
    const y = yAt(v)
    ctx.strokeStyle = "rgba(255,255,255,0.08)"
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(width - right, y)
    ctx.stroke()
    ctx.fillStyle = "rgba(255,255,255,0.5)"
    ctx.fillText(String(v), left - 6, y)
  }

  // 上がれなかったゲームは上の段に × で出す（説明はグラフの下の凡例）

  // 上がったゲームを線でつなぐ
  const accentColor = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#00ffc8"
  ctx.strokeStyle = accentColor
  ctx.lineWidth = 2
  ctx.beginPath()
  let started = false
  games.forEach((session, i) => {
    if (!session.zeroOne.finished) return
    const x = xAt(i)
    const y = yAt(session.zeroOne.finishDarts)
    if (!started) {
      ctx.moveTo(x, y)
      started = true
    } else {
      ctx.lineTo(x, y)
    }
  })
  ctx.stroke()

  const best = darts.length ? Math.min(...darts) : 0
  games.forEach((session, i) => {
    const x = xAt(i)
    if (session.zeroOne.finished) {
      const isBest = session.zeroOne.finishDarts === best
      ctx.fillStyle = isBest ? "#ffd54f" : accentColor
      ctx.beginPath()
      ctx.arc(x, yAt(session.zeroOne.finishDarts), isBest ? 5 : 4, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.strokeStyle = "#ff6b6b"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x - 4, 14)
      ctx.lineTo(x + 4, 22)
      ctx.moveTo(x + 4, 14)
      ctx.lineTo(x - 4, 22)
      ctx.stroke()
    }
  })

  // 横軸（古い → 新しい）
  ctx.fillStyle = "rgba(255,255,255,0.4)"
  ctx.textAlign = "left"
  ctx.fillText("old", left, height - 6)
  ctx.textAlign = "right"
  ctx.fillText("new", width - right, height - 6)
}


// ===============================
// ===== 上がりナンバー ===========
// ===============================
// 上がったゲームの最後の 1 投（刺さった場所）を数える
function getZeroOneFinishHit(session) {
  const darts = Array.isArray(session.darts) ? session.darts : []
  for (let i = darts.length - 1; i >= 0; i--) {
    if (darts[i]) return darts[i].hit
  }
  return null
}

function formatZeroOneHit(hit) {
  if (hit === "OB") return "Bull"
  if (hit === "IB") return "In-Bull"
  if (hit === "MISS") return "Miss"
  return hit
}

function renderZeroOneFinishNumbers(list) {

  const counts = {}
  let total = 0
  list.forEach(session => {
    if (!session.zeroOne.finished) return
    const hit = getZeroOneFinishHit(session)
    if (!hit) return
    counts[hit] = (counts[hit] || 0) + 1
    total++
  })

  if (!total) {
    return `
      <section class="data-summary-section">
        <h3 class="data-section-title">Finish Numbers</h3>
        <p class="z1-note">上がったゲームがまだありません。</p>
      </section>
    `
  }

  const hits = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 10)

  return `
    <section class="data-summary-section">
      <h3 class="data-section-title">Finish Numbers（${total} 回）</h3>
      <div class="z1-bars">
        ${hits.map(hit => `
          <div class="z1-bar-row">
            <span class="z1-bar-name">${formatZeroOneHit(hit)}</span>
            <span class="z1-bar"><span style="width:${(counts[hit] / total * 100).toFixed(1)}%"></span></span>
            <span class="z1-bar-rate">${(counts[hit] / total * 100).toFixed(1)}%</span>
            <span class="z1-bar-count">${counts[hit]}</span>
          </div>
        `).join("")}
      </div>
    </section>
  `
}


// ===============================
// ===== レーティングの目安 =======
// ===============================
// 01 のスタッツは「最初の点数の 80% を減らすまで」の 1 ラウンドあたりの平均点（80% スタッツ）で見るのが一般的なので、
// 1 ゲームごとに 80% に届いたラウンドまでの平均を出し、直近 30 ゲームの平均を rating.js の換算表で Rt の目安にする。
// 実際のレーティングはクリケットの成績や各社の計算方法でも変わるので、あくまで 01 だけから見たざっくりした目安
const DATA_01_RATING_GAMES = 30

function getZeroOneStats80(session) {

  const z = session.zeroOne
  const scores = Array.isArray(session.roundScores) ? session.roundScores : []
  const darts = Array.isArray(session.darts) ? session.darts : []
  const goal = z.start * 0.8

  let sum = 0
  let rounds = 0
  for (let i = 0; i < scores.length; i++) {
    // 投げていないラウンド（上がったあと・記録がない）は数えない
    const thrown = darts.slice(i * 3, i * 3 + 3).some(dart => dart)
    if (!thrown && darts.length) break
    sum += Number(scores[i]) || 0
    rounds++
    if (sum >= goal) break
  }

  return rounds ? sum / rounds : null
}

function renderZeroOneRating(list) {

  const stats = list
    .slice(-DATA_01_RATING_GAMES)
    .map(getZeroOneStats80)
    .filter(value => value !== null)

  if (!stats.length || typeof calcDartsLiveRT !== "function") return ""

  const ppr = stats.reduce((a, b) => a + b, 0) / stats.length
  const ppd = ppr / 3
  const rt = calcDartsLiveRT(ppd)
  const phx = calcPhoenixRating(ppd)

  return `
    <section class="rating-reference">
      <h3>レーティング参考値</h3>
      <div class="rating-current-grid">
        <div class="rating-current-card">
          <div class="rating-current-title">DARTSLIVE</div>
          <div class="rating-current-value">RT ${rt}</div>
        </div>
        <div class="rating-current-card">
          <div class="rating-current-title">PHOENIX</div>
          <div class="rating-current-value">RATING ${phx}</div>
        </div>
      </div>
      <div class="rating-current-note">80% スタッツ ${ppr.toFixed(1)}（PPD ${ppd.toFixed(2)}、直近 ${stats.length} ゲームの平均）から出した、01 だけで見たざっくりした目安です。80% スタッツは最初の点数の 80% を減らすまでの 1 ラウンドの平均点です。</div>
    </section>
  `
}
