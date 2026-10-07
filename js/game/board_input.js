// ===============================
// ===== ボード形式の入力 =========
// ===============================
// 入力パネルをダーツボード（SVG）で表示し、タップした場所から
// 点数・S/D/T・ブルを求めて addDart() に渡す。
// 点数計算・アワード判定・保存はボタン形式と同じ処理を通る。

// 時計回りに 20 から並ぶ数字（真上が 20）
const BOARD_NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

// 各輪の外側の半径（ダブルの外側 = 1）。
// 指で押せるよう、トリプル・ダブル・ブルは本物の比率より太く描く
// （本物の比率：インブル 0.037 / アウターブル 0.094 / トリプル 0.58〜0.63 / ダブル 0.95〜1）
const BOARD_RADIUS = {
  innerBull: 0.08,
  outerBull: 0.17,
  innerSingle: 0.52,
  triple: 0.63,
  outerSingle: 0.89,
  double: 1
}

// 本物のボードの比率での各輪の外側の半径（ダブルの外側 = 1。スティールボードの規格寸法から）。
// 刺さった位置を記録するときは、太く描いた輪の上の位置をこの比率に直す（toRealBoardPosition()）
const REAL_BOARD_RADIUS = {
  innerBull: 0.0374,
  outerBull: 0.0935,
  innerSingle: 0.5824,
  triple: 0.6294,
  outerSingle: 0.9529,
  double: 1
}

// 数字を書く輪の半径と、SVG の表示範囲（-BOARD_VIEW 〜 BOARD_VIEW）
const BOARD_NUMBER_RADIUS = 1.09
const BOARD_VIEW = 1.2

const SVG_NS = "http://www.w3.org/2000/svg"

// 2 本指で拡大できる最大の倍率
const BOARD_MAX_ZOOM = 4

// 拡大の状態（scale 倍率、cx・cy 表示の中心。ボードの位置で表す）。
// 画面の回転などでボードを作り直しても拡大したままにするため、ここに持つ
const boardZoom = { scale: 1, cx: 0, cy: 0 }
let boardZoomRound = 0

// 2 本指の操作の途中経過と、操作の直後のタップを入力にしないための時刻
let boardGesture = null
let boardIgnoreClickUntil = 0


// ===============================
// ===== 当たり判定 ===============
// ===============================
// x, y はボードの中心を原点、ダブルの外側を 1 とした位置（y は下向きが正）。
// 戻り値は addDart() にそのまま渡せる形
function getBoardHit(x, y) {

  const r = Math.sqrt(x * x + y * y)

  if (r > BOARD_RADIUS.double) {
    return { value: 0, multiplier: 1, special: null, label: "Miss" }
  }

  if (r <= BOARD_RADIUS.innerBull) {
    return { value: 25, multiplier: 2, special: "innerBull", label: "In-Bull" }
  }

  if (r <= BOARD_RADIUS.outerBull) {
    // ボタン形式の Bull と同じ（FAT は 50、SEPARATE は 25）
    const multiplier = bullMode === "fat" ? 2 : 1
    return { value: 25, multiplier, special: "outerBull", label: "Bull" }
  }

  // 真上を 0 度として時計回りの角度
  let angle = Math.atan2(x, -y) * 180 / Math.PI
  if (angle < 0) angle += 360

  const index = Math.floor(((angle + 9) % 360) / 18)
  const value = BOARD_NUMBERS[index]

  if (r <= BOARD_RADIUS.innerSingle) {
    return { value, multiplier: 1, special: null, label: `S${value}` }
  }
  if (r <= BOARD_RADIUS.triple) {
    return { value, multiplier: 3, special: null, label: `T${value}` }
  }
  if (r <= BOARD_RADIUS.outerSingle) {
    return { value, multiplier: 1, special: null, label: `S${value}` }
  }
  return { value, multiplier: 2, special: null, label: `D${value}` }
}


// 太く描いたボードの上の位置を、本物のボードの比率での位置に直す。
// 角度はそのままで、中心からの距離だけを輪ごとに比例で置き換える（輪の中での相対的な位置は変わらない）。
// ダブルの外（Miss）は、そのままの距離にする
function toRealBoardPosition(x, y) {

  const r = Math.sqrt(x * x + y * y)
  if (!r) return { x: 0, y: 0 }

  const keys = ["innerBull", "outerBull", "innerSingle", "triple", "outerSingle", "double"]
  let realR = r
  let inner = 0
  let realInner = 0

  for (let i = 0; i < keys.length; i++) {
    const outer = BOARD_RADIUS[keys[i]]
    const realOuter = REAL_BOARD_RADIUS[keys[i]]

    if (r <= outer) {
      realR = realInner + (r - inner) / (outer - inner) * (realOuter - realInner)
      break
    }

    inner = outer
    realInner = realOuter
  }

  const scale = realR / r

  return {
    x: +(x * scale).toFixed(4),
    y: +(y * scale).toFixed(4)
  }
}


// ===============================
// ===== SVG 生成 =================
// ===============================
function polarPoint(r, angleDeg) {

  const rad = angleDeg * Math.PI / 180

  return {
    x: +(r * Math.sin(rad)).toFixed(4),
    y: +(-r * Math.cos(rad)).toFixed(4)
  }
}

// 半径 r1〜r2、角度 a1〜a2（真上 0 度・時計回り）の扇形の帯
function ringSegmentPath(r1, r2, a1, a2) {

  const p1 = polarPoint(r2, a1)
  const p2 = polarPoint(r2, a2)
  const p3 = polarPoint(r1, a2)
  const p4 = polarPoint(r1, a1)

  return `M${p1.x} ${p1.y}` +
    `A${r2} ${r2} 0 0 1 ${p2.x} ${p2.y}` +
    `L${p3.x} ${p3.y}` +
    `A${r1} ${r1} 0 0 0 ${p4.x} ${p4.y}Z`
}

function createBoardSvgHtml() {

  const rings = [
    { from: BOARD_RADIUS.outerBull, to: BOARD_RADIUS.innerSingle, kind: "single" },
    { from: BOARD_RADIUS.innerSingle, to: BOARD_RADIUS.triple, kind: "triple" },
    { from: BOARD_RADIUS.triple, to: BOARD_RADIUS.outerSingle, kind: "single" },
    { from: BOARD_RADIUS.outerSingle, to: BOARD_RADIUS.double, kind: "double" }
  ]

  let segments = ""
  let numbers = ""

  BOARD_NUMBERS.forEach((num, i) => {

    const a1 = i * 18 - 9
    const a2 = i * 18 + 9
    const tone = i % 2 === 0 ? "a" : "b"

    rings.forEach(ring => {
      segments += `<path class="seg seg-${ring.kind} seg-${tone}" ` +
        `d="${ringSegmentPath(ring.from, ring.to, a1, a2)}"/>`
    })

    const p = polarPoint(BOARD_NUMBER_RADIUS, i * 18)
    numbers += `<text class="board-number" x="${p.x}" y="${p.y}">${num}</text>`
  })

  return `
    <svg class="board-svg" viewBox="${getBoardViewBox()}"
      preserveAspectRatio="xMidYMin meet"
      xmlns="${SVG_NS}" role="img" aria-label="ダーツボード">
      <circle class="board-back" r="${BOARD_VIEW}"/>
      ${segments}
      <circle class="seg seg-outer-bull" r="${BOARD_RADIUS.outerBull}"/>
      <circle class="seg seg-inner-bull" r="${BOARD_RADIUS.innerBull}"/>
      ${numbers}
      <g class="board-markers"></g>
    </svg>
  `
}


// ===============================
// ===== 表示・タップ =============
// ===============================
function renderBoardInput(container) {

  container.innerHTML = `
    <div class="board-wrap">
      ${createBoardSvgHtml()}
      <span class="board-last" aria-live="polite"></span>
      <button type="button" class="board-zoom-reset" hidden>全体表示</button>
    </div>
  `

  const svg = container.querySelector(".board-svg")
  svg.addEventListener("click", handleBoardTap)
  setupBoardZoomGestures(svg)

  container.querySelector(".board-zoom-reset").addEventListener("click", resetBoardZoom)

  updateBoardZoomView()
}

// 画面上のタップ位置を、ボードの位置（ダブルの外側 = 1）に変換する。
// SVG は縦横の短い方に合わせ、左右は中央・上下は上詰めで描かれる（preserveAspectRatio="xMidYMin meet"）。
// 拡大中は、今表示している範囲（viewBox）に合わせて計算する
function toBoardPosition(svg, clientX, clientY, zoom = boardZoom) {

  const rect = svg.getBoundingClientRect()
  const size = Math.min(rect.width, rect.height)
  if (!size) return null

  const viewSize = BOARD_VIEW * 2 / zoom.scale
  const unit = size / viewSize
  const left = rect.left + (rect.width - size) / 2

  return {
    x: zoom.cx - viewSize / 2 + (clientX - left) / unit,
    y: zoom.cy - viewSize / 2 + (clientY - rect.top) / unit
  }
}


// ===============================
// ===== 拡大・移動（2 本指） =====
// ===============================
function getBoardViewBox() {

  const size = BOARD_VIEW * 2 / boardZoom.scale
  const x = boardZoom.cx - size / 2
  const y = boardZoom.cy - size / 2

  return [x, y, size, size].map(n => +n.toFixed(4)).join(" ")
}

// 表示範囲がボードの外（-BOARD_VIEW〜BOARD_VIEW）へはみ出さないようにする
function clampBoardZoom() {

  boardZoom.scale = Math.max(1, Math.min(BOARD_MAX_ZOOM, boardZoom.scale))

  const limit = BOARD_VIEW - BOARD_VIEW / boardZoom.scale
  boardZoom.cx = Math.max(-limit, Math.min(limit, boardZoom.cx))
  boardZoom.cy = Math.max(-limit, Math.min(limit, boardZoom.cy))
}

function updateBoardZoomView() {

  const svg = document.querySelector(".board-svg")
  if (svg) svg.setAttribute("viewBox", getBoardViewBox())

  const resetBtn = document.querySelector(".board-zoom-reset")
  if (resetBtn) resetBtn.hidden = boardZoom.scale <= 1.01

  // 印は拡大しても同じ大きさに見えるよう描き直す
  renderBoardMarkers()
}

function resetBoardZoom() {

  boardZoom.scale = 1
  boardZoom.cx = 0
  boardZoom.cy = 0
  updateBoardZoomView()
}

function getTouchCenter(touches) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2
  }
}

function getTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

function setupBoardZoomGestures(svg) {

  svg.addEventListener("touchstart", event => {
    // 3 本指（戻る操作。cu_ui.js）になったら拡大はやめ、指を置く前の表示に戻す
    if (event.touches.length >= 3) {
      if (boardGesture && boardGesture.start) {
        boardZoom.scale = boardGesture.start.scale
        boardZoom.cx = boardGesture.start.cx
        boardZoom.cy = boardGesture.start.cy
        updateBoardZoomView()
      }
      boardGesture = { start: null, anchor: null }
      return
    }

    if (event.touches.length !== 2) return

    event.preventDefault()

    const start = { scale: boardZoom.scale, cx: boardZoom.cx, cy: boardZoom.cy }
    const center = getTouchCenter(event.touches)

    boardGesture = {
      start,
      distance: getTouchDistance(event.touches) || 1,
      // 指の間にあるボードの位置。拡大・移動してもこの位置が指の間に来るようにする
      anchor: toBoardPosition(svg, center.x, center.y, start)
    }
  }, { passive: false })

  svg.addEventListener("touchmove", event => {
    if (!boardGesture || event.touches.length !== 2) return

    event.preventDefault()

    const rect = svg.getBoundingClientRect()
    const size = Math.min(rect.width, rect.height)
    if (!size || !boardGesture.anchor) return

    const center = getTouchCenter(event.touches)
    const ratio = getTouchDistance(event.touches) / boardGesture.distance

    boardZoom.scale = Math.max(1, Math.min(BOARD_MAX_ZOOM, boardGesture.start.scale * ratio))

    const viewSize = BOARD_VIEW * 2 / boardZoom.scale
    const unit = size / viewSize
    const left = rect.left + (rect.width - size) / 2

    boardZoom.cx = boardGesture.anchor.x - (center.x - left) / unit + viewSize / 2
    boardZoom.cy = boardGesture.anchor.y - (center.y - rect.top) / unit + viewSize / 2

    clampBoardZoom()
    updateBoardZoomView()
  }, { passive: false })

  const endGesture = event => {
    if (!boardGesture) return
    if (event.touches.length >= 2) return

    // 2 本指・3 本指の操作のあと、残った指を離したときのタップは入力にしない
    boardGesture = null
    boardIgnoreClickUntil = Date.now() + 350
  }

  svg.addEventListener("touchend", endGesture)
  svg.addEventListener("touchcancel", endGesture)

  // iPad / iPhone の Safari で、ボードの上の 2 本指操作で画面全体が拡大されないようにする
  svg.addEventListener("gesturestart", event => event.preventDefault())
}

// 設定が「ラウンドごとに戻す」のとき、ラウンドが変わったら全体表示に戻す
function autoResetBoardZoom() {

  if (boardZoomRound === game.currentRound) return
  boardZoomRound = game.currentRound

  if (boardZoomReset === "round" && boardZoom.scale > 1) {
    resetBoardZoom()
  }
}

function handleBoardTap(event) {

  if (boardGesture || Date.now() < boardIgnoreClickUntil) return

  const pos = toBoardPosition(event.currentTarget, event.clientX, event.clientY)
  if (!pos) return

  // 表示範囲の外（四隅）も含め、ボードの外は Miss
  const hit = getBoardHit(pos.x, pos.y)

  addDart(hit.value, hit.multiplier, hit.special, {
    x: +pos.x.toFixed(3),
    y: +pos.y.toFixed(3)
  }, toRealBoardPosition(pos.x, pos.y))

  showBoardLastHit(hit)
}

function showBoardLastHit(hit) {

  const el = document.querySelector(".board-last")
  if (!el) return

  const score = hit.value * hit.multiplier
  el.textContent = hit.label === "Miss" ? "Miss" : `${hit.label}  ${score}`

  el.classList.remove("show")
  // 同じ表示が続いても毎回ふわっと出す
  void el.offsetWidth
  el.classList.add("show")
}

// 今のラウンド（3 投目のあとは、次の 1 投目まで直前のラウンド）のタップ位置に印を付ける
function getMarkerRound() {

  if (game.currentDart > 0) return game.rounds[game.currentRound] || []
  if (game.currentRound > 0) return game.rounds[game.currentRound - 1] || []
  return []
}

function renderBoardMarkers() {

  const layer = document.querySelector(".board-markers")
  if (!layer) return

  autoResetBoardZoom()

  const limit = BOARD_VIEW - 0.04
  // 拡大しても画面上の大きさが変わらないよう、倍率で割る
  const radius = +(0.045 / boardZoom.scale).toFixed(4)
  const fontSize = +(0.06 / boardZoom.scale).toFixed(4)

  // ボタンで入れた矢には位置がないので印は付けない（番号は何投目かのまま）
  layer.innerHTML = getMarkerRound()
    .map((dart, i) => {
      if (!dart || !dart.boardTap) return ""
      const x = Math.max(-limit, Math.min(limit, dart.boardTap.x))
      const y = Math.max(-limit, Math.min(limit, dart.boardTap.y))
      return `<g class="board-marker">` +
        `<circle cx="${x}" cy="${y}" r="${radius}"/>` +
        `<text x="${x}" y="${y}" style="font-size:${fontSize}px">${i + 1}</text>` +
        `</g>`
    })
    .join("")
}
