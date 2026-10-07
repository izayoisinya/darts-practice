// ===============================
// ===== ヒートマップ（Analysis） ==
// ===============================
// ゲーム履歴の 1 投ごとの記録（session.darts）から、刺さった位置の多いところを
// ボードの図の上に色の濃さで表示する。位置があるのはボード入力で入れた投だけ。
// あわせて、刺さった場所（T20・S20 など）の多い順の割合も出す（ボタン入力の投も含む）。
// 図の描画（paintHeatmap()）は、ゲーム画面の「このゲームのヒートマップ」（cu_ui.js）でも使う。

// 本物のボードの比率での各輪の外側の半径（ダブルの外側 = 1）。board_input.js の REAL_BOARD_RADIUS と同じ値
const HEATMAP_RING_RADIUS = [0.0374, 0.0935, 0.5824, 0.6294, 0.9529, 1]
const HEATMAP_NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

// 図の範囲（中心から ±HEATMAP_VIEW。数字の輪とボードの外のミスも入るように）
const HEATMAP_VIEW = 1.2
const HEATMAP_NUMBER_RADIUS = 1.1

// 1 投ぶんの色の広がり（ダブルの外側 = 1 としたときの半径）
const HEATMAP_SPREAD = 0.07

// 期間の選択肢（日数。0 は全期間）
const HEATMAP_PERIODS = { all: 0, d30: 30, d7: 7, d1: 1 }

// 数字の字体（データ画面のグラフと同じ。ゲーム画面では data.js を読み込まないのでここで持つ）
const HEATMAP_FONT = "'Segoe UI', 'Noto Sans JP', sans-serif"

let heatmapPeriod = "all"
let heatmapPalette = null


// ===============================
// ===== 集計 =====================
// ===============================
function getHeatmapSessions() {

  const days = HEATMAP_PERIODS[heatmapPeriod] || 0
  const sessions = readSessions().filter(s => (s.gameType || "countup") === "countup")
  if (!days) return sessions

  // 今日を含めて days 日ぶん（今日の 0 時から days - 1 日前の 0 時以降）
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  from.setDate(from.getDate() - (days - 1))

  return sessions.filter(s => s.date >= from.getTime())
}

function collectHeatmapData(sessions) {

  const points = []
  const hitCounts = {}
  let dartCount = 0
  let gameCount = 0

  sessions.forEach(session => {
    const darts = Array.isArray(session.darts) ? session.darts : []
    if (darts.some(dart => dart && dart.pos)) gameCount++

    darts.forEach(dart => {
      if (!dart) return
      dartCount++
      hitCounts[dart.hit] = (hitCounts[dart.hit] || 0) + 1
      if (dart.pos) points.push(dart.pos)
    })
  })

  return { points, hitCounts, dartCount, gameCount }
}


// ===============================
// ===== 描画 =====================
// ===============================
function renderAnalysisHeatmap() {

  setupHeatmapControls()

  const data = collectHeatmapData(getHeatmapSessions())

  renderHeatmapSummary(data)
  drawHeatmap(data.points)
}

function setupHeatmapControls() {

  const select = document.getElementById("heatmapPeriod")
  if (!select || select.dataset.ready) return

  select.value = heatmapPeriod
  select.addEventListener("change", () => {
    heatmapPeriod = select.value
    renderAnalysisHeatmap()
  })
  select.dataset.ready = "1"
}

function renderHeatmapSummary(data) {

  const count = document.getElementById("heatmapCount")
  if (count) {
    count.textContent = data.points.length
      ? `位置あり ${data.points.length} 投（${data.gameCount} ゲーム）`
      : ""
  }

  const box = document.getElementById("heatmapHits")
  if (!box) return

  if (!data.dartCount) {
    box.innerHTML = '<p class="heatmap-empty">1 投ごとの記録があるゲームがまだありません。2026/10/07 以降に終えたゲームから記録されます（位置はボード入力のときだけ）。</p>'
    return
  }

  // 刺さった場所の多い順（上位 8 か所）。棒の長さはいちばん多い場所を最大にする
  const hits = Object.keys(data.hitCounts)
    .sort((a, b) => data.hitCounts[b] - data.hitCounts[a])
    .slice(0, 8)
  const maxCount = data.hitCounts[hits[0]] || 1

  const rows = hits
    .map(hit => {
      const rate = data.hitCounts[hit] / data.dartCount * 100
      const bar = data.hitCounts[hit] / maxCount * 100
      return `
        <div class="heatmap-hit">
          <span class="heatmap-hit-name">${formatHeatmapHit(hit)}</span>
          <span class="heatmap-hit-bar"><span style="width:${bar.toFixed(1)}%"></span></span>
          <span class="heatmap-hit-rate">${rate.toFixed(1)}%</span>
        </div>
      `
    })
    .join("")

  box.innerHTML = `
    <div class="heatmap-hits-title">よく刺さった場所（全 ${data.dartCount} 投）</div>
    ${rows}
  `
}

function formatHeatmapHit(hit) {
  if (hit === "OB") return "Bull"
  if (hit === "IB") return "In-Bull"
  if (hit === "MISS") return "Miss"
  return hit
}

function drawHeatmap(points) {

  const canvas = document.getElementById("heatmapCanvas")
  if (!canvas) return

  const canvasState = setupHiDPICanvas(canvas, 320)
  if (!canvasState) {
    scheduleChartRetry("heatmap", () => drawHeatmap(points))
    return
  }
  resetChartRetry("heatmap")

  const { ctx, width, height } = canvasState
  paintHeatmap(ctx, width, height, points)
}

// ボードの図と、刺さった位置の色・点を描く（width / height は CSS ピクセル）
//   highlight：特に目立たせたい位置（ゲーム画面で今のラウンドの投に使う）
function paintHeatmap(ctx, width, height, points, highlight = []) {

  const size = Math.min(width, height)
  const unit = size / (HEATMAP_VIEW * 2)
  const cx = width / 2
  const cy = height / 2

  ctx.clearRect(0, 0, width, height)

  drawHeatmapBoard(ctx, cx, cy, unit)

  if (!points.length) return

  // 色の濃さは、いちばん多い場所を最大にした相対値で表す
  const heat = createHeatLayer(points, Math.round(width), Math.round(height), cx, cy, unit)
  if (heat) ctx.drawImage(heat, 0, 0, width, height)

  // 1 投ずつの位置も小さな点で重ねる
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)"
  points.forEach(p => {
    ctx.beginPath()
    ctx.arc(cx + p.x * unit, cy + p.y * unit, 1.3, 0, Math.PI * 2)
    ctx.fill()
  })

  // 目立たせる位置は白い縁取りの点にする
  ctx.lineWidth = 1.5
  highlight.forEach(p => {
    ctx.beginPath()
    ctx.arc(cx + p.x * unit, cy + p.y * unit, Math.max(3, unit * 0.04), 0, Math.PI * 2)
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)"
    ctx.strokeStyle = "rgba(0, 0, 0, 0.6)"
    ctx.fill()
    ctx.stroke()
  })
}

// ボードの図（本物の比率）。色は控えめにして、上に重ねる色が見えやすいようにする
function drawHeatmapBoard(ctx, cx, cy, unit) {

  const r = value => value * unit

  ctx.fillStyle = "#0b0e13"
  ctx.beginPath()
  ctx.arc(cx, cy, r(HEATMAP_VIEW), 0, Math.PI * 2)
  ctx.fill()

  // セグメントの塗り（シングルは 2 色、トリプル・ダブルは赤青を薄く）
  const [ib, ob, is, t, os, d] = HEATMAP_RING_RADIUS
  const bands = [
    [ob, is, ["#1c212b", "#262c37"]],
    [is, t, ["rgba(184,64,76,.45)", "rgba(47,111,179,.45)"]],
    [t, os, ["#1c212b", "#262c37"]],
    [os, d, ["rgba(184,64,76,.45)", "rgba(47,111,179,.45)"]]
  ]

  HEATMAP_NUMBERS.forEach((num, i) => {
    const a1 = (i * 18 - 9 - 90) * Math.PI / 180
    const a2 = (i * 18 + 9 - 90) * Math.PI / 180

    bands.forEach(([inner, outer, colors]) => {
      ctx.fillStyle = colors[i % 2]
      ctx.beginPath()
      ctx.arc(cx, cy, r(outer), a1, a2)
      ctx.arc(cx, cy, r(inner), a2, a1, true)
      ctx.closePath()
      ctx.fill()
    })

    const a = (i * 18 - 90) * Math.PI / 180
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)"
    ctx.font = `600 ${Math.max(9, Math.round(unit * 0.09))}px ${HEATMAP_FONT}`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(String(num), cx + Math.cos(a) * r(HEATMAP_NUMBER_RADIUS), cy + Math.sin(a) * r(HEATMAP_NUMBER_RADIUS))
  })

  ctx.fillStyle = "rgba(184,64,76,.55)"
  ctx.beginPath()
  ctx.arc(cx, cy, r(ob), 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = "#12161d"
  ctx.beginPath()
  ctx.arc(cx, cy, r(ib), 0, Math.PI * 2)
  ctx.fill()

  // 輪とセグメントの境目の線
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)"
  ctx.lineWidth = 1
  HEATMAP_RING_RADIUS.forEach(value => {
    ctx.beginPath()
    ctx.arc(cx, cy, r(value), 0, Math.PI * 2)
    ctx.stroke()
  })
  for (let i = 0; i < 20; i++) {
    const a = (i * 18 - 9 - 90) * Math.PI / 180
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * r(ob), cy + Math.sin(a) * r(ob))
    ctx.lineTo(cx + Math.cos(a) * r(d), cy + Math.sin(a) * r(d))
    ctx.stroke()
  }
}

// 1 投ずつぼかした円を足し合わせ、多いところほど赤く・少ないところほど青くした画像を作る
function createHeatLayer(points, width, height, cx, cy, unit) {

  const layer = document.createElement("canvas")
  layer.width = width
  layer.height = height

  const ctx = layer.getContext("2d")
  if (!ctx) return null

  const radius = Math.max(6, HEATMAP_SPREAD * unit)
  // 本数が多いほど 1 投ぶんを薄くして、色が飽和しにくくする
  const alpha = Math.max(0.04, Math.min(0.35, 6 / points.length))

  ctx.globalCompositeOperation = "lighter"
  points.forEach(p => {
    const x = cx + p.x * unit
    const y = cy + p.y * unit
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius)
    g.addColorStop(0, `rgba(0, 0, 0, ${alpha})`)
    g.addColorStop(1, "rgba(0, 0, 0, 0)")
    ctx.fillStyle = g
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  })

  const image = ctx.getImageData(0, 0, width, height)
  const pixels = image.data

  let max = 0
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] > max) max = pixels[i]
  }
  if (!max) return null

  const palette = getHeatmapPalette()

  for (let i = 0; i < pixels.length; i += 4) {
    const value = pixels[i + 3]
    if (!value) continue

    const t = value / max
    const index = Math.min(255, Math.round(t * 255)) * 4
    pixels[i] = palette[index]
    pixels[i + 1] = palette[index + 1]
    pixels[i + 2] = palette[index + 2]
    pixels[i + 3] = Math.round(Math.min(1, 0.25 + t) * 215)
  }

  ctx.globalCompositeOperation = "source-over"
  ctx.putImageData(image, 0, 0)
  return layer
}

// 0（少ない）〜 1（多い）を 青 → 水色 → 緑 → 黄 → 赤 に対応させる 256 色
function getHeatmapPalette() {

  if (heatmapPalette) return heatmapPalette

  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 1

  const ctx = canvas.getContext("2d")
  const g = ctx.createLinearGradient(0, 0, 256, 0)
  g.addColorStop(0, "#2f6fff")
  g.addColorStop(0.3, "#00d0ff")
  g.addColorStop(0.5, "#3cff7a")
  g.addColorStop(0.75, "#ffe14d")
  g.addColorStop(1, "#ff3b3b")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 1)

  heatmapPalette = ctx.getImageData(0, 0, 256, 1).data
  return heatmapPalette
}
