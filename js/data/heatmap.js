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

// ボードの中心からダブルの外側までの実際の長さ（mm）。位置（ダブルの外側 = 1）を mm に直すのに使う。
// 設定画面の Board Size（dartsSettings.boardSize）で選ぶ：ソフト（15.5 インチ。DARTSLIVE などと同じ）/ スティール（13.2 インチ）
const BOARD_RADIUS_MM = { soft: 197, steel: 170 }

function getBoardRadiusMm() {
  try {
    const settings = JSON.parse(localStorage.getItem("dartsSettings")) || {}
    return settings.boardSize === "steel" ? BOARD_RADIUS_MM.steel : BOARD_RADIUS_MM.soft
  } catch {
    return BOARD_RADIUS_MM.soft
  }
}

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
  renderHeatmapRange(data.points, getHeatmapSessions())
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
  drawRangeCircles(ctx, width, height, getRangeStats(points))
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


// ===============================
// ===== レーダー風（ゲーム画面） ==
// ===============================
// ゲーム画面の「このゲームのヒートマップ」用。暗い緑の画面に輪と線だけでボードを描き、
// 刺さった位置を光る点（ブリップ）で表す。重なるほど明るく、古い投ほど薄く、今のラウンドの投は輪付きで強く光らせる。
// 回る走査線は CSS（lay_input.css の .game-radar-sweep）で重ねる
//   points：古い順の位置の一覧 / highlight：今のラウンドの投の位置 / rgb：色（"0, 255, 200" の形）
function paintRadarHeatmap(ctx, width, height, points, highlight = [], rgb = "0, 255, 200") {

  const size = Math.min(width, height)
  const unit = size / (HEATMAP_VIEW * 2)
  const cx = width / 2
  const cy = height / 2
  const r = value => value * unit
  const color = alpha => `rgba(${rgb}, ${alpha})`
  const outer = HEATMAP_VIEW - 0.02

  ctx.clearRect(0, 0, width, height)

  // 画面：中心ほど少し明るい暗緑の円
  const back = ctx.createRadialGradient(cx, cy, 0, cx, cy, r(outer))
  back.addColorStop(0, "#06231c")
  back.addColorStop(1, "#020b09")
  ctx.fillStyle = back
  ctx.beginPath()
  ctx.arc(cx, cy, r(outer), 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r(outer), 0, Math.PI * 2)
  ctx.clip()

  // 20 区画の境目の線（ブルの外から）
  ctx.strokeStyle = color(0.1)
  ctx.lineWidth = 1
  for (let i = 0; i < 20; i++) {
    const a = (i * 18 - 9 - 90) * Math.PI / 180
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * r(HEATMAP_RING_RADIUS[1]), cy + Math.sin(a) * r(HEATMAP_RING_RADIUS[1]))
    ctx.lineTo(cx + Math.cos(a) * r(1), cy + Math.sin(a) * r(1))
    ctx.stroke()
  }

  // トリプル・ダブルの輪は帯を薄く塗り、ボードの輪は線で描く
  const [ib, ob, , t, os, d] = HEATMAP_RING_RADIUS
  ctx.fillStyle = color(0.07)
  ;[[os, d], [HEATMAP_RING_RADIUS[2], t]].forEach(([inner, outerR]) => {
    ctx.beginPath()
    ctx.arc(cx, cy, r(outerR), 0, Math.PI * 2)
    ctx.arc(cx, cy, r(inner), 0, Math.PI * 2, true)
    ctx.fill()
  })

  HEATMAP_RING_RADIUS.forEach(value => {
    ctx.strokeStyle = color(value === d ? 0.55 : 0.28)
    ctx.beginPath()
    ctx.arc(cx, cy, r(value), 0, Math.PI * 2)
    ctx.stroke()
  })

  // 外周の目盛り（4.5 度ごと。区画の境目は長め。区画の中心は数字があるので描かない）
  for (let deg = 0; deg < 360; deg += 4.5) {
    if (deg % 18 === 0) continue
    const a = (deg - 90) * Math.PI / 180
    const long = deg % 18 === 9
    const r1 = r(outer) - (long ? 7 : 3)
    ctx.strokeStyle = color(long ? 0.5 : 0.22)
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
    ctx.lineTo(cx + Math.cos(a) * r(outer), cy + Math.sin(a) * r(outer))
    ctx.stroke()
  }

  // 数字
  ctx.fillStyle = color(0.6)
  ctx.font = `600 ${Math.max(8, Math.round(unit * 0.085))}px ui-monospace, Menlo, monospace`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  HEATMAP_NUMBERS.forEach((num, i) => {
    const a = (i * 18 - 90) * Math.PI / 180
    ctx.fillText(String(num), cx + Math.cos(a) * r(HEATMAP_NUMBER_RADIUS), cy + Math.sin(a) * r(HEATMAP_NUMBER_RADIUS))
  })

  // ブリップ：光をぼかして足し合わせる（重なるほど明るい）。古い投ほど薄く
  ctx.globalCompositeOperation = "lighter"
  const glow = Math.max(7, unit * 0.11)
  points.forEach((p, index) => {
    const age = points.length > 1 ? index / (points.length - 1) : 1
    const alpha = 0.25 + age * 0.35
    const x = cx + p.x * unit
    const y = cy + p.y * unit
    const g = ctx.createRadialGradient(x, y, 0, x, y, glow)
    g.addColorStop(0, color(alpha))
    g.addColorStop(1, color(0))
    ctx.fillStyle = g
    ctx.fillRect(x - glow, y - glow, glow * 2, glow * 2)

    ctx.fillStyle = color(0.45 + age * 0.4)
    ctx.beginPath()
    ctx.arc(x, y, 1.6, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.globalCompositeOperation = "source-over"

  // 今のラウンドの投：白く光る点と輪
  highlight.forEach(p => {
    const x = cx + p.x * unit
    const y = cy + p.y * unit

    ctx.shadowColor = color(1)
    ctx.shadowBlur = 10
    ctx.fillStyle = "#eafffa"
    ctx.beginPath()
    ctx.arc(x, y, 2.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    ctx.strokeStyle = color(0.85)
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(x, y, Math.max(6, unit * 0.07), 0, Math.PI * 2)
    ctx.stroke()
  })

  ctx.restore()

  // 外枠
  ctx.strokeStyle = color(0.6)
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(cx, cy, r(outer) - 0.75, 0, Math.PI * 2)
  ctx.stroke()
}


// ===============================
// ===== レンジ（中心からの距離） ==
// ===============================
// 刺さった位置がボードの中心（ブル）からどれくらい離れているか。位置はタップした場所なので、ざっくりした目安。
// RANGE：DARTSLIVE の RANGE（ブルの中心のまわりのまとまりを円の直径 mm で表したもの。算出方法は非公開）に近い目安として、
//   ブルの中心を狙ったときの縦横のばらつき（標準偏差 σ。σ² = 中心からの距離の 2 乗の平均 ÷ 2）を求め、直径 2σ の円とする。
//   この円には約 4 割の投が入る。プロの RANGE（30mm 台）とブル率の関係とおおむね合う
//   r50 / r80：半分・8 割の投が入る円の半径（位置の単位。ダブルの外側 = 1）
// 1 ゲームの RANGE（位置の記録が 3 投以上あるときだけ。01 はブルを狙う場面の投だけ）
function getSessionRange(session) {

  if (!session) return null

  const points = session.gameType === "01"
    ? (typeof getZeroOne80Points === "function" ? getZeroOne80Points(session) : [])
    : (session.darts || []).filter(dart => dart && dart.pos).map(dart => dart.pos)

  return getRangeStats(points)
}

// ゲームごとの RANGE（mm）の平均。ブルモードがセパレートのゲームは含めない
//   { avg, games }（数えたゲームがなければ null）
function getAverageRange(list) {

  const values = (list || [])
    .filter(session => session && session.bullMode !== "double")
    .map(getSessionRange)
    .filter(Boolean)
    .map(range => range.rangeMm)

  if (!values.length) return null

  return {
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    games: values.length
  }
}

function getRangeStats(points) {

  if (!points || points.length < 3) return null

  const distances = points
    .map(p => Math.sqrt(p.x * p.x + p.y * p.y))
    .sort((a, b) => a - b)

  const at = rate => distances[Math.min(distances.length - 1, Math.max(0, Math.ceil(distances.length * rate) - 1))]
  const sigma = Math.sqrt(distances.reduce((sum, d) => sum + d * d, 0) / distances.length / 2)
  const mm = getBoardRadiusMm()

  return {
    count: distances.length,
    sigma,
    r50: at(0.5),
    r80: at(0.8),
    rangeMm: sigma * 2 * mm,
    d50Mm: at(0.5) * 2 * mm,
    d80Mm: at(0.8) * 2 * mm
  }
}

// ブル率からの RANGE の目安（位置の記録がないボタン入力のゲームでも出せる）。
// ばらつきが上と同じ形（中心に寄った丸い広がり）と考え、アウターブルの円（半径はボードの大きさの 0.0935 倍）に入る割合が
// ブル率になる σ を逆算する：ブル率 = 1 − exp(−R² ÷ 2σ²)
function getRangeFromBullRate(bullRate) {
  const p = Math.min(0.99, Math.max(0.01, bullRate))
  const bullRadius = getBoardRadiusMm() * HEATMAP_RING_RADIUS[1]
  return bullRadius / Math.sqrt(-2 * Math.log(1 - p)) * 2
}

function renderHeatmapRange(points, sessions = []) {

  const box = document.getElementById("heatmapRange")
  if (!box) return

  const range = getRangeStats(points)

  // ブル率（カウントアップは 1 ゲーム 24 投）
  const darts = sessions.length * 24
  const bulls = sessions.reduce((sum, session) => sum + (session.bulls || 0), 0)
  // ブルが 0 本だと推定できない（いくらでも大きくなる）ので出さない
  const fromBull = darts && bulls ? getRangeFromBullRate(bulls / darts) : 0

  if (!range && !darts) {
    box.innerHTML = ""
    return
  }

  box.innerHTML = `
    <div class="heatmap-range-title">RANGE（目安）</div>
    <div class="heatmap-range-values">
      <span class="main"><b>${range ? range.rangeMm.toFixed(1) : "-"}</b> mm<small>刺さった位置から</small></span>
      <span><b>${fromBull ? fromBull.toFixed(1) : "-"}</b> mm<small>ブル率 ${darts ? (bulls / darts * 100).toFixed(1) : "-"}% から</small></span>
      <span><b>${range ? range.d80Mm.toFixed(0) : "-"}</b> mm<small>8 割が入る円</small></span>
    </div>
    <p class="heatmap-range-note">DARTSLIVE の RANGE（ブルの中心のまわりのまとまりを円の直径で表したもの。小さいほどまとまっている）に近い目安です。算出方法は公開されていないので、ばらつき（標準偏差）から出した直径で代わりにしています。位置はタップした場所なので、ざっくりした値として見てください。図の実線の円が RANGE、点線が 8 割の投が入る範囲です。ボードの大きさは設定画面の Board Size で変えられます。</p>
  `
}

// ヒートマップの図に、RANGE の円（実線）と 8 割の投が入る円（点線）を重ねる
function drawRangeCircles(ctx, width, height, range) {

  if (!range) return

  const unit = Math.min(width, height) / (HEATMAP_VIEW * 2)
  const cx = width / 2
  const cy = height / 2

  ctx.save()
  ctx.lineWidth = 1.5
  ctx.font = `700 10px ${HEATMAP_FONT}`
  ctx.textAlign = "left"
  ctx.textBaseline = "bottom"

  // 文字が重ならないよう、RANGE は右上、80% は左上に書く
  ;[
    [range.sigma, "RANGE", "rgba(255, 255, 255, 0.95)", [], -Math.PI / 4, "left", 3],
    [range.r80, "80%", "rgba(255, 213, 79, 0.9)", [4, 4], -Math.PI * 3 / 4, "right", -3]
  ].forEach(([r, label, color, dash, a, align, dx]) => {
    ctx.setLineDash(dash)
    ctx.strokeStyle = color
    ctx.beginPath()
    ctx.arc(cx, cy, r * unit, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = color
    ctx.textAlign = align
    ctx.fillText(label, cx + Math.cos(a) * r * unit + dx, cy + Math.sin(a) * r * unit - 2)
  })

  ctx.restore()
}


// ===============================
// ===== 1 ゲームのヒートマップ ===
// ===============================
// 履歴カード（カウントアップ・01）を開いたときに、そのゲームの刺さった位置を出す。
// カードを作るときは位置だけを canvas に持たせ（閉じている間は大きさが測れないため）、開いたときに描く（data_loader.js の toggleSessionCard()）
//   showRange：RANGE（中心のまわりのまとまり）も出すか / rangePoints：RANGE に使う位置（01 はブルを狙う場面の投だけ。省くと全部の投）
function createSessionHeatmapHtml(session, showRange = false, rangePoints = null) {

  const points = (Array.isArray(session.darts) ? session.darts : [])
    .filter(dart => dart && dart.pos)
    .map(dart => [+dart.pos.x.toFixed(3), +dart.pos.y.toFixed(3)])

  const forRange = rangePoints
    ? rangePoints.map(p => [+p.x.toFixed(3), +p.y.toFixed(3)])
    : points
  const range = showRange && forRange.length >= 3
    ? getRangeStats(forRange.map(([x, y]) => ({ x, y })))
    : null

  const body = points.length
    ? `<canvas class="session-heatmap" data-points='${JSON.stringify(points)}'${range ? ` data-range-points='${JSON.stringify(forRange)}'` : ""}></canvas>`
    : '<div class="session-heatmap-empty">位置の記録がありません（ボード入力のゲームだけ）</div>'

  return `
    <div class="session-meta-block session-heatmap-block">
      <div class="session-meta-title">Heatmap${points.length ? `（${points.length} 投${range ? ` · RANGE ${range.rangeMm.toFixed(1)}mm` : ""}）` : ""}</div>
      ${body}
    </div>
  `
}

function drawSessionHeatmaps(card) {

  if (!card || typeof paintHeatmap !== "function") return

  card.querySelectorAll("canvas.session-heatmap").forEach(canvas => {
    const size = canvas.clientWidth
    if (!size) return

    let points = []
    try {
      points = JSON.parse(canvas.dataset.points || "[]").map(([x, y]) => ({ x, y }))
    } catch {
      points = []
    }

    const ratio = Math.min(window.devicePixelRatio || 1, 3)
    canvas.style.height = `${size}px`
    canvas.width = Math.round(size * ratio)
    canvas.height = Math.round(size * ratio)

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)

    paintHeatmap(ctx, size, size, points)

    // RANGE の円（実線）と 8 割の円（点線）も重ねる
    if (canvas.dataset.rangePoints) {
      try {
        const rangePoints = JSON.parse(canvas.dataset.rangePoints).map(([x, y]) => ({ x, y }))
        drawRangeCircles(ctx, size, size, getRangeStats(rangePoints))
      } catch {
        // 読めないときは円を描かない
      }
    }
  })
}

// 画面の向き・大きさが変わったら、開いているカードのヒートマップを描き直す
let sessionHeatmapResizeTimer = null
window.addEventListener("resize", () => {
  clearTimeout(sessionHeatmapResizeTimer)
  sessionHeatmapResizeTimer = setTimeout(() => {
    document.querySelectorAll(".session-card.is-expanded").forEach(drawSessionHeatmaps)
  }, 150)
})
