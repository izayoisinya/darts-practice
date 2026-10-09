// ===============================
// ===== 週・月・年の期間 ==========
// ===============================
// 週（月曜はじまり）・月・年の期間の計算（データのトップの練習量と、Stats の Period で使う）と、
// Stats の Period（ゲームの種類ごとの、期間ごとの平均の推移。直近 12 期間の棒グラフと、今の期間・前の期間の比較）。
//   Count-Up：平均 PPD / 01：上がったゲームの平均ダーツ数（少ないほど良い）/ Cricket：平均 MPR

const PERIOD_LABELS = { week: "Week", month: "Month", year: "Year" }
const PERIOD_PREV_LABELS = { week: "Last Week", month: "Last Month", year: "Last Year" }
const PERIOD_NOW_LABELS = { week: "This Week", month: "This Month", year: "This Year" }
const PERIOD_TREND_COUNT = 12
const STATS_PERIOD_KEY = "dartsStatsPeriod"

// 期間の始まりと終わり（終わりは次の期間の始まり）。offset で前後の期間
function getPeriodRange(base, mode, offset = 0) {
  if (mode === "year") {
    const y = base.getFullYear() + offset
    return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) }
  }
  if (mode === "month") {
    const start = new Date(base.getFullYear(), base.getMonth() + offset, 1)
    return { start, end: new Date(start.getFullYear(), start.getMonth() + 1, 1) }
  }
  const day = base.getDay()
  const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate() + (day === 0 ? -6 : 1 - day))
  const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset * 7)
  return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7) }
}

function formatPeriodLabel(range, mode) {
  const s = range.start
  if (mode === "year") return `${s.getFullYear()}`
  if (mode === "month") return `${s.getFullYear()}/${s.getMonth() + 1}`
  const last = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate() - 1)
  return `${s.getMonth() + 1}/${s.getDate()} – ${last.getMonth() + 1}/${last.getDate()}`
}

// グラフの横軸の短いラベル
function formatPeriodTick(range, mode) {
  const s = range.start
  if (mode === "year") return `${s.getFullYear()}`
  if (mode === "month") return s.getMonth() === 0 ? `${s.getFullYear() % 100}/1` : `${s.getMonth() + 1}`
  return `${s.getMonth() + 1}/${s.getDate()}`
}

function getSessionsInPeriod(sessions, range) {
  const start = range.start.getTime()
  const end = range.end.getTime()
  return sessions.filter(s => s.date >= start && s.date < end)
}


// ===============================
// ===== Stats の Period ===========
// ===============================
let statsPeriodMode = (() => {
  try {
    const saved = localStorage.getItem(STATS_PERIOD_KEY)
    return PERIOD_LABELS[saved] ? saved : "week"
  } catch {
    return "week"
  }
})()

// ゲームの種類ごとの比べる数字
const PERIOD_METRICS = {
  countup: { label: "Avg PPD", digits: 2, better: "higher", rgb: "0 255 200", value: s => Number(s.ppd) || 0 },
  "01": { label: "Avg Darts", digits: 1, better: "lower", rgb: "77 171 255", value: s => s.zeroOne && s.zeroOne.finished && s.zeroOne.finishDarts > 0 ? s.zeroOne.finishDarts : null },
  cricket: { label: "Avg MPR", digits: 2, better: "higher", rgb: "255 196 64", value: s => s.cricket ? Number(s.cricket.mpr) || 0 : null }
}

function getPeriodStatsType() {
  return typeof dataGameType === "string" ? dataGameType : "countup"
}

function getPeriodTypeSessions(type) {
  if (typeof readHistorySessions !== "function") return []
  return readHistorySessions().filter(s => getHistoryGameType(s) === type)
}

// 1 つの期間の平均（値のないゲームは数えない。01 は上がったゲームだけ）
function getPeriodAverage(list, metric) {
  const values = list.map(metric.value).filter(v => v !== null)
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

// 直近 PERIOD_TREND_COUNT 期間（古い順。最後が今の期間）
function getPeriodTrend(type, mode) {
  const metric = PERIOD_METRICS[type]
  const sessions = getPeriodTypeSessions(type)
  const now = new Date()
  const list = []
  for (let i = PERIOD_TREND_COUNT - 1; i >= 0; i--) {
    const range = getPeriodRange(now, mode, -i)
    const games = getSessionsInPeriod(sessions, range)
    list.push({ range, games: games.length, avg: getPeriodAverage(games, metric) })
  }
  return list
}

function formatPeriodDiff(now, prev, metric) {
  if (now === null || prev === null) return '<span class="data-hub-period-diff even">-</span>'
  const diff = now - prev
  if (Math.abs(diff) < Math.pow(10, -metric.digits) / 2) return '<span class="data-hub-period-diff even">±0</span>'
  const good = metric.better === "lower" ? diff < 0 : diff > 0
  return `<span class="data-hub-period-diff ${good ? "up" : "down"}">${diff > 0 ? "+" : "−"}${Math.abs(diff).toFixed(metric.digits)}</span>`
}

function renderStatsPeriod() {

  const box = document.getElementById("periodTrendSection")
  if (!box) return

  const type = getPeriodStatsType()
  const metric = PERIOD_METRICS[type]
  const mode = statsPeriodMode
  const trend = getPeriodTrend(type, mode)
  const nowItem = trend[trend.length - 1]
  const prevItem = trend[trend.length - 2]
  const fmt = v => v === null ? "-" : v.toFixed(metric.digits)

  box.innerHTML = `
    <div class="period-trend-top">
      <h3 class="data-section-title">Period</h3>
      <span class="data-hub-period-tabs" role="group" aria-label="期間">
        ${Object.keys(PERIOD_LABELS).map(key => `
          <button type="button" data-stats-period="${key}" class="${key === mode ? "active" : ""}" aria-pressed="${key === mode}">${PERIOD_LABELS[key]}</button>
        `).join("")}
      </span>
    </div>
    <div class="period-trend-compare" style="--badge-rgb: ${metric.rgb}">
      <div class="period-trend-item">
        <small>${PERIOD_NOW_LABELS[mode]} · ${formatPeriodLabel(nowItem.range, mode)}</small>
        <strong>${fmt(nowItem.avg)}</strong>
        <small>${metric.label} · ${nowItem.games} games</small>
      </div>
      <div class="period-trend-item">
        <small>${PERIOD_PREV_LABELS[mode]} · ${formatPeriodLabel(prevItem.range, mode)}</small>
        <strong>${fmt(prevItem.avg)}</strong>
        <small>${metric.label} · ${prevItem.games} games</small>
      </div>
      <div class="period-trend-item diff">
        <small>Diff</small>
        ${formatPeriodDiff(nowItem.avg, prevItem.avg, metric)}
        <small>${metric.better === "lower" ? "少ないほど良い" : "多いほど良い"}</small>
      </div>
    </div>
    <canvas id="periodTrendChart" class="period-trend-chart"></canvas>
    <p class="period-trend-note">直近 ${PERIOD_TREND_COUNT} ${mode === "week" ? "週" : mode === "month" ? "か月" : "年"}の ${metric.label}${type === "01" ? "（上がったゲームだけ）" : ""}。棒の上の数字はゲーム数</p>
  `

  requestAnimationFrame(() => drawStatsPeriodChart(trend, metric, mode))
}

function drawStatsPeriodChart(trend, metric, mode) {

  const canvas = document.getElementById("periodTrendChart")
  if (!canvas || typeof setupHiDPICanvas !== "function" || !canvas.offsetWidth) return
  const state = setupHiDPICanvas(canvas, 180)
  if (!state) return

  const { ctx, width, height } = state
  const pad = { left: 36, right: 8, top: 18, bottom: 22 }
  const graphW = width - pad.left - pad.right
  const graphH = height - pad.top - pad.bottom
  const values = trend.map(item => item.avg).filter(v => v !== null)

  ctx.clearRect(0, 0, width, height)
  ctx.font = "10px 'Segoe UI', 'Noto Sans JP', sans-serif"

  if (!values.length) {
    ctx.fillStyle = "rgba(154,164,178,0.8)"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("この期間の記録はまだありません", width / 2, height / 2)
    return
  }

  // 縦軸は 0 からではなく、値の範囲に少し余白を付ける（差が見えるように）
  const maxV = Math.max(...values)
  const minV = Math.min(...values)
  const span = Math.max(maxV - minV, maxV * 0.1, 0.5)
  const top = maxV + span * 0.25
  const bottom = Math.max(0, minV - span * 0.6)
  const y = v => pad.top + graphH - (v - bottom) / (top - bottom) * graphH

  // 横線と目盛り
  ctx.strokeStyle = "rgba(255,255,255,0.06)"
  ctx.fillStyle = "rgba(154,164,178,0.8)"
  ctx.textAlign = "right"
  ctx.textBaseline = "middle"
  for (let i = 0; i <= 3; i++) {
    const v = bottom + (top - bottom) * i / 3
    const yy = y(v)
    ctx.beginPath()
    ctx.moveTo(pad.left, yy)
    ctx.lineTo(width - pad.right, yy)
    ctx.stroke()
    ctx.fillText(v.toFixed(metric.digits === 2 ? 1 : 0), pad.left - 6, yy)
  }

  const slot = graphW / trend.length
  const barW = Math.max(6, Math.min(32, slot * 0.6))
  const best = metric.better === "lower" ? Math.min(...values) : Math.max(...values)

  trend.forEach((item, i) => {
    const cx = pad.left + slot * i + slot / 2
    ctx.textAlign = "center"

    if (item.avg !== null) {
      const yy = y(item.avg)
      const isNow = i === trend.length - 1
      const alpha = isNow ? 0.95 : 0.55
      // 古い Safari でも読めるよう、カンマ区切りの rgba で指定する
      ctx.fillStyle = item.avg === best ? `rgba(255, 215, 114, ${alpha})` : `rgba(${metric.rgb.split(" ").join(", ")}, ${alpha})`
      ctx.fillRect(cx - barW / 2, yy, barW, pad.top + graphH - yy)

      // ゲーム数
      ctx.fillStyle = "rgba(230,237,243,0.75)"
      ctx.textBaseline = "bottom"
      ctx.fillText(String(item.games), cx, yy - 2)
    }

    // 横軸のラベル（多いときは 1 つおき。今の期間は必ず出す）
    if (trend.length <= 8 || i % 2 === (trend.length - 1) % 2) {
      ctx.fillStyle = i === trend.length - 1 ? "rgba(230,237,243,0.95)" : "rgba(154,164,178,0.8)"
      ctx.textBaseline = "top"
      ctx.fillText(formatPeriodTick(item.range, mode), cx, pad.top + graphH + 6)
    }
  })
}

let statsPeriodBound = false

function setupStatsPeriod() {
  if (statsPeriodBound) return
  statsPeriodBound = true

  document.addEventListener("click", e => {
    const btn = e.target instanceof Element ? e.target.closest("[data-stats-period]") : null
    if (!btn) return
    statsPeriodMode = btn.dataset.statsPeriod
    try { localStorage.setItem(STATS_PERIOD_KEY, statsPeriodMode) } catch {}
    renderStatsPeriod()
  })

  let timer = null
  window.addEventListener("resize", () => {
    if (typeof viewMode === "undefined" || viewMode !== "stats") return
    clearTimeout(timer)
    timer = setTimeout(renderStatsPeriod, 150)
  })
}

window.addEventListener("DOMContentLoaded", setupStatsPeriod)
