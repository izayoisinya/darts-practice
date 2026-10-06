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
  outerSingle: 0.84,
  double: 1
}

// 数字を書く輪の半径と、SVG の表示範囲（-BOARD_VIEW 〜 BOARD_VIEW）
const BOARD_NUMBER_RADIUS = 1.09
const BOARD_VIEW = 1.2

const SVG_NS = "http://www.w3.org/2000/svg"


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

  const v = BOARD_VIEW

  return `
    <svg class="board-svg" viewBox="${-v} ${-v} ${v * 2} ${v * 2}"
      preserveAspectRatio="xMidYMin meet"
      xmlns="${SVG_NS}" role="img" aria-label="ダーツボード">
      <circle class="board-back" r="${v}"/>
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
    </div>
  `

  const svg = container.querySelector(".board-svg")
  svg.addEventListener("click", handleBoardTap)

  renderBoardMarkers()
}

// 画面上のタップ位置を、ボードの位置（ダブルの外側 = 1）に変換する。
// SVG は縦横の短い方に合わせ、左右は中央・上下は上詰めで描かれる（preserveAspectRatio="xMidYMin meet"）
function toBoardPosition(svg, clientX, clientY) {

  const rect = svg.getBoundingClientRect()
  const size = Math.min(rect.width, rect.height)
  if (!size) return null

  const unit = size / (BOARD_VIEW * 2)

  return {
    x: (clientX - (rect.left + rect.width / 2)) / unit,
    y: (clientY - (rect.top + size / 2)) / unit
  }
}

function handleBoardTap(event) {

  const pos = toBoardPosition(event.currentTarget, event.clientX, event.clientY)
  if (!pos) return

  // 表示範囲の外（四隅）も含め、ボードの外は Miss
  const hit = getBoardHit(pos.x, pos.y)

  addDart(hit.value, hit.multiplier, hit.special, {
    x: +pos.x.toFixed(3),
    y: +pos.y.toFixed(3)
  })

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

  const limit = BOARD_VIEW - 0.04

  // ボタンで入れた矢には位置がないので印は付けない（番号は何投目かのまま）
  layer.innerHTML = getMarkerRound()
    .map((dart, i) => {
      if (!dart || !dart.boardTap) return ""
      const x = Math.max(-limit, Math.min(limit, dart.boardTap.x))
      const y = Math.max(-limit, Math.min(limit, dart.boardTap.y))
      return `<g class="board-marker">` +
        `<circle cx="${x}" cy="${y}" r="0.045"/>` +
        `<text x="${x}" y="${y}">${i + 1}</text>` +
        `</g>`
    })
    .join("")
}
