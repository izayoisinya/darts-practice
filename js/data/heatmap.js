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
let heatmapTrendMetric = "range"
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

  const sessions = getHeatmapSessions()
  const data = collectHeatmapData(sessions)

  renderHeatmapSummary(data)
  renderHeatmapRange(data.points, sessions)
  drawHeatmap(data.points)
  renderHeatmapTrend(sessions)
}

function setupHeatmapControls() {

  const group = document.getElementById("heatmapPeriod")
  if (!group || group.dataset.ready) return
  group.dataset.ready = "1"

  group.addEventListener("click", e => {
    const btn = e.target instanceof Element ? e.target.closest("[data-heatmap-period]") : null
    if (!btn) return
    heatmapPeriod = btn.dataset.heatmapPeriod
    renderAnalysisHeatmap()
  })

  const metric = document.getElementById("heatmapTrendMetric")
  if (metric) {
    metric.addEventListener("click", e => {
      const btn = e.target instanceof Element ? e.target.closest("[data-heatmap-metric]") : null
      if (!btn) return
      heatmapTrendMetric = btn.dataset.heatmapMetric
      renderHeatmapTrend(getHeatmapSessions())
    })
  }
}

// ボタンの選ばれている印を付け直す
function markHeatmapButtons(groupId, attr, value) {
  const group = document.getElementById(groupId)
  if (!group) return
  group.querySelectorAll(`[${attr}]`).forEach(btn => {
    const active = btn.getAttribute(attr) === value
    btn.classList.toggle("active", active)
    btn.setAttribute("aria-pressed", String(active))
  })
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
//   cricket：クリケットのときだけ、数字ごとの状態 { 20: "open" | "closed", ..., 25: ... }。
//     狙う数字の区画をうっすら塗って数字を明るく太く、クローズした数字は薄くして線を引き、それ以外の数字は暗くする
function paintRadarHeatmap(ctx, width, height, points, highlight = [], rgb = "0, 255, 200", cricket = null) {

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

  // クリケット：狙う数字の区画（ブルの外からダブルまで）とブルを塗る。まだクローズしていない数字ほど明るく
  if (cricket) {
    const fill = state => color(state === "closed" ? 0.06 : 0.2)
    HEATMAP_NUMBERS.forEach((num, i) => {
      if (!cricket[num]) return
      const a1 = (i * 18 - 9 - 90) * Math.PI / 180
      const a2 = (i * 18 + 9 - 90) * Math.PI / 180
      ctx.fillStyle = fill(cricket[num])
      ctx.beginPath()
      ctx.arc(cx, cy, r(d), a1, a2)
      ctx.arc(cx, cy, r(ob), a2, a1, true)
      ctx.closePath()
      ctx.fill()
    })
    if (cricket[25]) {
      ctx.fillStyle = fill(cricket[25])
      ctx.beginPath()
      ctx.arc(cx, cy, r(ob), 0, Math.PI * 2)
      ctx.fill()
    }
  }

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

  // 数字（クリケットは、狙う数字を明るく太く、クローズした数字は薄くして線を引き、それ以外は暗く）
  const fontSize = Math.max(8, Math.round(unit * 0.085))
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  HEATMAP_NUMBERS.forEach((num, i) => {
    const a = (i * 18 - 90) * Math.PI / 180
    const x = cx + Math.cos(a) * r(HEATMAP_NUMBER_RADIUS)
    const y = cy + Math.sin(a) * r(HEATMAP_NUMBER_RADIUS)
    const state = cricket ? cricket[num] || "off" : ""

    ctx.font = `${state === "open" ? 800 : 600} ${state === "open" ? Math.round(fontSize * 1.25) : fontSize}px ui-monospace, Menlo, monospace`
    ctx.fillStyle = state === "open" ? color(1) : state === "closed" ? color(0.4) : state === "off" ? color(0.22) : color(0.6)
    if (state === "open") {
      ctx.shadowColor = color(0.9)
      ctx.shadowBlur = 6
    }
    ctx.fillText(String(num), x, y)
    ctx.shadowBlur = 0

    if (state === "closed") {
      const half = ctx.measureText(String(num)).width / 2 + 1
      ctx.strokeStyle = color(0.6)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x - half, y)
      ctx.lineTo(x + half, y)
      ctx.stroke()
    }
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


// ===============================
// ===== 期間の中の推移 =============
// ===============================
// ヒートマップの期間の中で、RANGE・ブル率・8 割が入る円がどう変わったかを折れ線で出す。
//   区切り：Today はゲームごと、7 Days・30 Days は日ごと、All は週ごと（月曜はじまり。直近 HEATMAP_TREND_MAX 週）
//   RANGE・8 割の円はその区切りの位置の記録をまとめて計算（上の数字と同じ方法）。ブル率は 1 ゲーム 24 投として数える
const HEATMAP_TREND_MAX = 30
const HEATMAP_TREND_METRICS = {
  range: { label: "RANGE", unit: "mm", digits: 1, better: "lower", note: "小さいほどまとまっている" },
  bull: { label: "Bull", unit: "%", digits: 1, better: "higher", note: "多いほど良い" },
  d80: { label: "80% Circle", unit: "mm", digits: 0, better: "lower", note: "8 割の投が入る円の直径。小さいほど良い" }
}

function getHeatmapTrendGroups(sessions) {

  const mode = heatmapPeriod === "d1" ? "game" : heatmapPeriod === "all" ? "week" : "day"
  const groups = []
  const byKey = {}

  sessions
    .slice()
    .sort((a, b) => a.date - b.date)
    .forEach((session, index) => {
      const date = new Date(session.date)
      let key = index
      let label = `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`
      if (mode === "day") {
        key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
        label = `${date.getMonth() + 1}/${date.getDate()}`
      } else if (mode === "week" && typeof getPeriodRange === "function") {
        const start = getPeriodRange(date, "week").start
        key = start.getTime()
        label = `${start.getMonth() + 1}/${start.getDate()}`
      }
      if (!byKey[key]) {
        byKey[key] = { label, list: [] }
        groups.push(byKey[key])
      }
      byKey[key].list.push(session)
    })

  return {
    mode,
    groups: groups.slice(-HEATMAP_TREND_MAX).map(group => {
      const points = []
      group.list.forEach(session => {
        ;(session.darts || []).forEach(dart => {
          if (dart && dart.pos) points.push(dart.pos)
        })
      })
      const range = getRangeStats(points)
      const darts = group.list.length * 24
      const bulls = group.list.reduce((sum, session) => sum + (session.bulls || 0), 0)
      return {
        label: group.label,
        games: group.list.length,
        range: range ? range.rangeMm : null,
        d80: range ? range.d80Mm : null,
        bull: darts ? bulls / darts * 100 : null
      }
    })
  }
}

function renderHeatmapTrend(sessions) {

  markHeatmapButtons("heatmapPeriod", "data-heatmap-period", heatmapPeriod)
  markHeatmapButtons("heatmapTrendMetric", "data-heatmap-metric", heatmapTrendMetric)

  const metric = HEATMAP_TREND_METRICS[heatmapTrendMetric]
  const trend = getHeatmapTrendGroups(sessions)
  const unitName = { game: "ゲーム", day: "日", week: "週" }[trend.mode]

  const title = document.getElementById("heatmapTrendTitle")
  if (title) title.textContent = `Trend（${unitName}ごと）`

  const note = document.getElementById("heatmapTrendNote")
  if (note) {
    note.textContent = trend.mode === "week"
      ? `直近 ${HEATMAP_TREND_MAX} 週までの ${metric.label}（${metric.unit}、${metric.note}）。金色は一番良い${unitName}`
      : `${metric.label}（${metric.unit}、${metric.note}）。金色は一番良い${unitName}`
  }

  requestAnimationFrame(() => drawHeatmapTrend(trend.groups, metric, heatmapTrendMetric))
}

function drawHeatmapTrend(groups, metric, key) {

  const canvas = document.getElementById("heatmapTrendChart")
  if (!canvas || typeof setupHiDPICanvas !== "function" || !canvas.offsetWidth) return
  const state = setupHiDPICanvas(canvas, 200)
  if (!state) return

  const { ctx, width, height } = state
  const pad = { left: 40, right: 16, top: 22, bottom: 24 }
  const graphW = width - pad.left - pad.right
  const graphH = height - pad.top - pad.bottom
  const items = groups.map((group, i) => ({ i, label: group.label, value: group[key] }))
  const values = items.filter(item => item.value !== null).map(item => item.value)

  ctx.clearRect(0, 0, width, height)
  ctx.font = `10px ${HEATMAP_FONT}`

  if (!values.length) {
    ctx.fillStyle = "rgba(154,164,178,0.8)"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(key === "bull" ? "この期間の記録はまだありません" : "位置の記録（ボード入力）がまだありません", width / 2, height / 2)
    return
  }

  // 縦軸は値の範囲に少し余白を付ける（差が見えるように）
  const maxV = Math.max(...values)
  const minV = Math.min(...values)
  const span = Math.max(maxV - minV, maxV * 0.1, 1)
  const top = maxV + span * 0.2
  const bottom = Math.max(0, minV - span * 0.2)
  const y = v => pad.top + graphH - (v - bottom) / (top - bottom) * graphH
  // 区切りごとに同じ幅の枠を取り、その真ん中に点を置く（数が少なくても端に寄らない）
  const x = i => pad.left + graphW * (i + 0.5) / items.length

  // 横線と目盛り
  ctx.strokeStyle = "rgba(255,255,255,0.06)"
  ctx.fillStyle = "rgba(154,164,178,0.8)"
  ctx.textAlign = "right"
  ctx.textBaseline = "middle"
  for (let i = 0; i <= 3; i++) {
    const v = bottom + (top - bottom) * i / 3
    ctx.beginPath()
    ctx.moveTo(pad.left, y(v))
    ctx.lineTo(width - pad.right, y(v))
    ctx.stroke()
    ctx.fillText(v.toFixed(0), pad.left - 6, y(v))
  }

  // 横軸のラベル（多いときは間引く。最後は必ず出す）
  const step = Math.ceil(items.length / Math.max(2, Math.floor(graphW / 48)))
  ctx.textAlign = "center"
  ctx.textBaseline = "top"
  items.forEach(item => {
    if ((items.length - 1 - item.i) % step !== 0) return
    ctx.fillStyle = item.i === items.length - 1 ? "rgba(230,237,243,0.95)" : "rgba(154,164,178,0.8)"
    ctx.fillText(item.label, x(item.i), pad.top + graphH + 6)
  })

  // 線（値のない区切りは飛ばしてつなぐ）
  const drawn = items.filter(item => item.value !== null)
  ctx.strokeStyle = "rgba(0, 255, 200, 0.85)"
  ctx.lineWidth = 2
  ctx.beginPath()
  drawn.forEach((item, n) => {
    if (n === 0) ctx.moveTo(x(item.i), y(item.value))
    else ctx.lineTo(x(item.i), y(item.value))
  })
  ctx.stroke()
  ctx.lineWidth = 1

  // 点と数字（多いときは一番良い点と最後の点だけ数字を出す）
  const best = metric.better === "lower" ? minV : maxV
  const showAll = drawn.length <= 12
  drawn.forEach((item, n) => {
    const isBest = item.value === best
    const isLast = n === drawn.length - 1
    ctx.fillStyle = isBest ? "#ffd772" : "#00ffc8"
    ctx.beginPath()
    ctx.arc(x(item.i), y(item.value), isBest || isLast ? 4 : 3, 0, Math.PI * 2)
    ctx.fill()
    if (showAll || isBest || isLast) {
      ctx.fillStyle = isBest ? "#ffd772" : "rgba(230,237,243,0.85)"
      ctx.textBaseline = "bottom"
      ctx.fillText(item.value.toFixed(metric.digits), x(item.i), y(item.value) - 6)
    }
  })
}

