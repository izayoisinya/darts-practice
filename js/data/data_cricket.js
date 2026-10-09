// ===============================
// ===== データ画面のクリケット ====
// ===============================
// クリケットの記録の表示（MPR・クローズ率・クローズまでのダーツ数・推移・数字ごとのマーク・一覧）。
// 01 と同じく、カウントアップと同じ場所（右の History・左の Stats）に出す（切り替えは data_01.js の setDataGameType()）

const DATA_CRICKET_CHART_GAMES = 30
const DATA_CRICKET_RATING_GAMES = 30
const DATA_CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25]

// アワードの表示名（表示順。ゲーム画面の stats.js の CRICKET_AWARD_LABELS と同じ）
const DATA_CRICKET_AWARD_LABELS = [
  ["threeInTheBlack", "3 in the Black"],
  ["hatTrick", "Hat Trick"],
  ["threeInTheBed", "3 in the Bed"],
  ["whiteHorse", "White Horse"],
  ["marks9", "9 Marks"],
  ["marks8", "8 Marks"],
  ["marks7", "7 Marks"],
  ["marks6", "6 Marks"],
  ["marks5", "5 Marks"]
]

let dataCricketRounds = "all"

function readCricketSessions() {
  return readSessions().filter(session => session && session.gameType === "cricket" && session.cricket)
}

function getCricketFilteredSessions() {
  const sessions = readCricketSessions()
  return dataCricketRounds === "all"
    ? sessions
    : sessions.filter(session => String(session.cricket.rounds) === dataCricketRounds)
}

// 1 投が入ったクリケットの数字とマーク数（game_cricket.js の getCricketMark() と同じ。データ画面では読み込まないので持つ）
function getDataCricketMark(dart) {
  if (!dart) return null
  if (dart.hit === "IB") return { target: 25, marks: 2 }
  if (dart.hit === "OB") return { target: 25, marks: 1 }
  const match = /^([SDT])(\d+)$/.exec(dart.hit || "")
  if (!match) return null
  const value = Number(match[2])
  if (value < 15 || value > 20) return null
  return { target: value, marks: { S: 1, D: 2, T: 3 }[match[1]] }
}

// 数字ごとのマーク数（全部クローズしたあとの投は記録に残らないので、記録の投を全部数える）
function countCricketTargetMarks(list) {
  const counts = {}
  DATA_CRICKET_TARGETS.forEach(target => { counts[target] = 0 })
  list.forEach(session => {
    ;(Array.isArray(session.darts) ? session.darts : []).forEach(dart => {
      const mark = getDataCricketMark(dart)
      if (mark) counts[mark.target] += mark.marks
    })
  })
  return counts
}

function formatCricketTarget(target) {
  return target === 25 ? "BULL" : String(target)
}


// ===============================
// ===== 表示 =====================
// ===============================
function renderCricketData() {

  const panel = document.getElementById("zeroOneStatsPanel")
  const history = document.getElementById("sessionsContainer")
  if (!panel || !history) return

  const sessions = readCricketSessions()

  if (!sessions.length) {
    panel.innerHTML = `
      <section class="data-summary-section">
        <h3 class="data-section-title">Stats</h3>
        <p>クリケットの記録はまだありません。</p>
        <button type="button" class="z1-play" onclick="location.href = 'countup.html?game=cricket'">クリケットを始める</button>
      </section>
    `
    // History は全ゲームの一覧（data_loader.js）なので、クリケットの記録がなくてもほかのゲームは出す
    renderHistory()
    return
  }

  // ラウンドの上限ごとにまとめる
  const roundsList = []
  sessions.forEach(session => {
    const key = String(session.cricket.rounds)
    if (!roundsList.includes(key)) roundsList.push(key)
  })
  roundsList.sort((a, b) => Number(a) - Number(b))
  if (dataCricketRounds !== "all" && !roundsList.includes(dataCricketRounds)) dataCricketRounds = "all"

  const options = [`<option value="all">All Rounds（${sessions.length}）</option>`]
    .concat(roundsList.map(key => {
      const count = sessions.filter(session => String(session.cricket.rounds) === key).length
      return `<option value="${key}">R${key}（${count}）</option>`
    }))
    .join("")

  const list = getCricketFilteredSessions()

  panel.innerHTML = `
    <div class="z1-filter">
      <select id="cricketRoundsSelect" aria-label="クリケットのラウンド数">${options}</select>
    </div>
    <section class="data-summary-section">
      <h3 class="data-section-title">Stats</h3>
      <div class="z1-stat-cards">${renderCricketStatCards(list)}</div>
    </section>
    <section class="data-summary-section">
      <h3 class="data-section-title">Awards</h3>
      <div class="z1-award-cards">${renderCricketAwardCards(list)}</div>
    </section>
    ${typeof renderZeroOneHitRates === "function" ? renderZeroOneHitRates(list) : ""}
    <section class="data-summary-section">
      <h3 class="data-section-title">MPR Trend (Last ${DATA_CRICKET_CHART_GAMES} Games)</h3>
      <canvas id="cricketChart" class="z1-chart"></canvas>
      <div class="z1-legend">
        <span><i class="z1-dot out"></i>全部クローズしたゲーム</span>
        <span><i class="z1-dot fail"></i>クローズできなかった</span>
      </div>
    </section>
    ${renderCricketRating(list)}
    ${renderCricketTargetMarks(list)}
  `

  const select = document.getElementById("cricketRoundsSelect")
  select.value = dataCricketRounds
  select.addEventListener("change", () => {
    dataCricketRounds = select.value
    renderCricketData()
  })

  // History は全ゲームを 1 か所に出す（data_loader.js の renderHistory()）
  renderHistory()
  requestAnimationFrame(() => drawCricketChart(list))
}

function renderCricketStatCards(list) {

  const average = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
  const mprs = list.map(session => session.cricket.mpr)
  const finished = list.filter(session => session.cricket.finished)
  const darts = finished.map(session => session.cricket.finishDarts).filter(n => n > 0)
  const recent = list.slice(-10).map(session => session.cricket.mpr)

  return [
    ["Games Played", list.length],
    ["Average MPR", list.length ? average(mprs).toFixed(2) : "-"],
    ["Best MPR", list.length ? Math.max(...mprs).toFixed(2) : "-"],
    ["Close Rate", list.length ? `${(finished.length / list.length * 100).toFixed(0)}%` : "-"],
    ["Avg Darts to Close", darts.length ? average(darts).toFixed(1) : "-"],
    ["Best Darts to Close", darts.length ? Math.min(...darts) : "-"],
    // 直近 10 ゲームの平均 MPR（最近の調子の目安）
    ["MPR (Last 10)", recent.length ? average(recent).toFixed(2) : "-"]
  ]
    .map(([title, value]) => `
      <div class="data-card">
        <span class="data-title">${title}</span>
        <span class="data-value">${value}</span>
      </div>
    `)
    .join("")
}

function renderCricketAwardCards(list) {

  const totals = {}
  DATA_CRICKET_AWARD_LABELS.forEach(([key]) => { totals[key] = 0 })
  list.forEach(session => {
    const awards = session.awards || {}
    DATA_CRICKET_AWARD_LABELS.forEach(([key]) => { totals[key] += awards[key] || 0 })
  })

  return DATA_CRICKET_AWARD_LABELS
    .map(([key, label]) => `
      <div class="data-card">
        <span class="data-title">${label}</span>
        <span class="data-value">${totals[key]}</span>
      </div>
    `)
    .join("")
}

// レーティングの目安：直近 30 ゲームの平均 MPR を DARTSLIVE の目安の表（rating.js）に当てる
function renderCricketRating(list) {

  const recent = list.slice(-DATA_CRICKET_RATING_GAMES).map(session => session.cricket.mpr)
  if (!recent.length || typeof calcDartsLiveRTFromMpr !== "function") return ""

  const mpr = recent.reduce((a, b) => a + b, 0) / recent.length

  return `
    <section class="rating-reference">
      <h3>レーティング参考値</h3>
      <div class="rating-current-grid">
        <div class="rating-current-card">
          <div class="rating-current-title">DARTSLIVE</div>
          <div class="rating-current-value">RT ${calcDartsLiveRTFromMpr(mpr)}</div>
        </div>
      </div>
      <div class="rating-current-note">MPR ${mpr.toFixed(2)}（直近 ${recent.length} ゲームの平均）から出した、クリケットだけで見たざっくりした目安です。1 人の練習なので、相手がいるときより MPR は高めに出ます。</div>
    </section>
  `
}

// 数字ごとのマーク数の割合（どの数字でマークを取れているか）
function renderCricketTargetMarks(list) {

  const counts = countCricketTargetMarks(list)
  const total = DATA_CRICKET_TARGETS.reduce((sum, target) => sum + counts[target], 0)
  if (!total) return ""

  return `
    <section class="data-summary-section">
      <h3 class="data-section-title">Marks by Number（${total} マーク）</h3>
      <div class="z1-bars">
        ${DATA_CRICKET_TARGETS.map(target => `
          <div class="z1-bar-row">
            <span class="z1-bar-name">${formatCricketTarget(target)}</span>
            <span class="z1-bar"><span style="width:${(counts[target] / total * 100).toFixed(1)}%"></span></span>
            <span class="z1-bar-rate">${(counts[target] / total * 100).toFixed(1)}%</span>
            <span class="z1-bar-count">${counts[target]}</span>
          </div>
        `).join("")}
      </div>
    </section>
  `
}


// ===============================
// ===== History のカード ===========
// ===============================
// History は全ゲームで 1 つの一覧（data_loader.js の renderHistory()）。クリケットのゲームはこのカードで出す
function createCricketCardHtml(session, gameNumber) {

  const c = session.cricket
  const hits = typeof getZeroOneHitCounts === "function" ? getZeroOneHitCounts(session) : { darts: 0, bulls: 0, inner: 0, triples: 0 }
  const rate = count => hits.darts ? (count / hits.darts * 100).toFixed(1) : "0.0"

  const summary = [
    `R${c.rounds}`,
    c.finished ? `CLOSED ${c.finishDarts} darts` : "NOT CLOSED",
    `${c.points} pts`,
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
            <span class="session-kpi-label">MPR</span>
            <span class="session-kpi-value">${c.mpr.toFixed(2)}</span>
          </div>
          <div class="session-kpi-item">
            <span class="session-kpi-label">Marks</span>
            <span class="session-kpi-value">${c.marks}</span>
          </div>
          <div class="session-kpi-item">
            <span class="session-kpi-label">${c.finished ? "Close Darts" : "Close"}</span>
            ${c.finished
              ? `<span class="session-kpi-value z1-out">${c.finishDarts}</span>`
              : `<span class="session-kpi-value z1-fail">${countCricketClosed(session)}/7</span>`}
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
          ${typeof createZeroOneTripleHtml === "function" ? createZeroOneTripleHtml(session) : ""}
        </div>

        <div class="session-meta-block session-awards-block">
          <div class="session-meta-title">Awards</div>
          <div class="session-awards-grid">${createAwardsHtml(session, DATA_CRICKET_AWARD_LABELS)}</div>
        </div>
      </div>

      <div class="session-side-block">
        <div class="session-meta-block session-round-block">
          <div class="session-meta-title">Round Marks</div>
          <div class="round-chart">${createRoundChartHtml(session.roundScores || [], 9)}</div>
        </div>
        ${typeof createSessionHeatmapHtml === "function" ? createSessionHeatmapHtml(session) : ""}
      </div>
    </div>
  `
}

// 1 ゲームでクローズした数字の数（記録の投から数える）
function countCricketClosed(session) {
  const counts = countCricketTargetMarks([session])
  return DATA_CRICKET_TARGETS.filter(target => counts[target] >= 3).length
}




// ===============================
// ===== MPR の推移 ===============
// ===============================
// 全部クローズしたゲームは緑の点、クローズできなかったゲームは赤の点。最高の MPR は金色
function drawCricketChart(list) {

  const canvas = document.getElementById("cricketChart")
  if (!canvas || typeof setupHiDPICanvas !== "function") return

  // 隠れている（スマホ縦で History を見ている）ときは大きさが測れないので、Stats を開いたときに描く（redrawVisibleCharts）
  if (!canvas.offsetWidth) return
  const state = setupHiDPICanvas(canvas, 200)
  if (!state) return

  const { ctx, width, height } = state
  const games = list.slice(-DATA_CRICKET_CHART_GAMES)
  const values = games.map(session => session.cricket.mpr)

  const left = 34
  const right = 12
  const top = 14
  const bottom = 20
  const graphWidth = width - left - right
  const graphHeight = height - top - bottom

  // 縦軸は 0.5 単位に丸めた MPR の範囲
  const yMax = Math.max(1, Math.ceil((Math.max(0, ...values) + 0.25) * 2) / 2)
  const yMin = Math.max(0, Math.floor((Math.min(yMax, ...values) - 0.25) * 2) / 2)

  const xAt = i => left + (games.length > 1 ? graphWidth * i / (games.length - 1) : graphWidth / 2)
  const yAt = value => top + graphHeight - (value - yMin) / Math.max(0.5, yMax - yMin) * graphHeight

  ctx.clearRect(0, 0, width, height)

  ctx.font = "600 10px 'Segoe UI', 'Noto Sans JP', sans-serif"
  ctx.textAlign = "right"
  ctx.textBaseline = "middle"
  const step = Math.max(0.5, Math.ceil((yMax - yMin) / 4 * 2) / 2)
  for (let v = yMin; v <= yMax + 0.001; v += step) {
    const y = yAt(v)
    ctx.strokeStyle = "rgba(255,255,255,0.08)"
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(width - right, y)
    ctx.stroke()
    ctx.fillStyle = "rgba(255,255,255,0.5)"
    ctx.fillText(v.toFixed(1), left - 6, y)
  }

  const accentColor = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#00ffc8"

  ctx.strokeStyle = accentColor
  ctx.lineWidth = 2
  ctx.beginPath()
  values.forEach((value, i) => {
    if (i === 0) ctx.moveTo(xAt(i), yAt(value))
    else ctx.lineTo(xAt(i), yAt(value))
  })
  ctx.stroke()

  const best = values.length ? Math.max(...values) : 0
  games.forEach((session, i) => {
    const isBest = session.cricket.mpr === best
    ctx.fillStyle = isBest ? "#ffd54f" : session.cricket.finished ? accentColor : "#ff6b6b"
    ctx.beginPath()
    ctx.arc(xAt(i), yAt(session.cricket.mpr), isBest ? 5 : 4, 0, Math.PI * 2)
    ctx.fill()
  })

  ctx.fillStyle = "rgba(255,255,255,0.4)"
  ctx.textAlign = "left"
  ctx.fillText("old", left, height - 6)
  ctx.textAlign = "right"
  ctx.fillText("new", width - right, height - 6)
}
