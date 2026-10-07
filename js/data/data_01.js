// ===============================
// ===== データ画面の 01 ===========
// ===============================
// ヘッダーの COUNT-UP / 01 の切り替えと、01 の記録の表示（設定ごとの上がり率・上がるまでのダーツ数・推移・一覧）。
// カウントアップの表示（data.js など）には手を入れず、01 のときは body に data-01 を付けて 01 用の画面（#zeroOneView）に入れ替える

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
    renderZeroOneData()
  } else if (typeof redrawVisibleCharts === "function") {
    // 隠していた間に大きさが測れなかったグラフを描き直す
    requestAnimationFrame(() => redrawVisibleCharts())
  }
}

// 画面の大きさ・向きが変わったら 01 のグラフも描き直す
let data01ResizeTimer = null
window.addEventListener("resize", () => {
  if (dataGameType !== "01") return
  clearTimeout(data01ResizeTimer)
  data01ResizeTimer = setTimeout(() => {
    const list = data01ConfigKey === "all"
      ? readZeroOneSessions()
      : readZeroOneSessions().filter(session => getZeroOneConfigKey(session.zeroOne) === data01ConfigKey)
    drawZeroOneChart(list)
  }, 150)
})

// ===============================
// ===== 01 の表示 ================
// ===============================
function renderZeroOneData() {

  const view = document.getElementById("zeroOneView")
  if (!view) return

  const sessions = readZeroOneSessions()

  if (!sessions.length) {
    view.innerHTML = `
      <div class="z1-empty">
        <p>01 の記録はまだありません。</p>
        <button type="button" class="z1-play" onclick="location.href = 'countup.html?game=01'">01 を始める</button>
      </div>
    `
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

  const list = data01ConfigKey === "all"
    ? sessions
    : sessions.filter(session => getZeroOneConfigKey(session.zeroOne) === data01ConfigKey)

  const options = [`<option value="all">All Settings（${sessions.length}）</option>`]
    .concat(keys.map(key => {
      const count = sessions.filter(session => getZeroOneConfigKey(session.zeroOne) === key).length
      return `<option value="${key}">${formatZeroOneConfigKey(key)}（${count}）</option>`
    }))
    .join("")

  view.innerHTML = `
    <div class="z1-main">
      <div class="z1-filter">
        <select id="z1ConfigSelect" aria-label="01 の設定">${options}</select>
      </div>
      ${renderZeroOneSummary(list)}
      <section class="z1-section">
        <h3 class="data-section-title">Darts to Finish（Last ${DATA_01_CHART_GAMES} Games）</h3>
        <canvas id="z1Chart"></canvas>
        <div class="z1-legend">
          <span><i class="z1-dot out"></i>上がったダーツ数</span>
          <span><i class="z1-dot fail"></i>上がれなかった</span>
        </div>
      </section>
    </div>
    <div class="z1-history">
      <h3 class="data-section-title">History</h3>
      <div class="z1-list">${list.slice().reverse().map(renderZeroOneCard).join("")}</div>
    </div>
  `

  const select = document.getElementById("z1ConfigSelect")
  select.value = data01ConfigKey
  select.addEventListener("change", () => {
    data01ConfigKey = select.value
    renderZeroOneData()
  })

  requestAnimationFrame(() => drawZeroOneChart(list))
}

function renderZeroOneSummary(list) {

  const finished = list.filter(session => session.zeroOne.finished)
  const darts = finished.map(session => session.zeroOne.finishDarts).filter(n => n > 0)
  const avgDarts = darts.length ? darts.reduce((a, b) => a + b, 0) / darts.length : 0
  const avgPpd = list.length ? list.reduce((sum, session) => sum + (session.ppd || 0), 0) / list.length : 0

  // 直近 10 ゲームの上がり率（調子の目安）
  const recent = list.slice(-10)
  const recentRate = recent.length ? recent.filter(session => session.zeroOne.finished).length / recent.length * 100 : 0

  const tiles = [
    ["FINISH", list.length ? `${(finished.length / list.length * 100).toFixed(0)}%` : "-", `${finished.length} / ${list.length}`],
    ["AVG DARTS", avgDarts ? avgDarts.toFixed(1) : "-", "上がったゲーム"],
    ["BEST", darts.length ? Math.min(...darts) : "-", "darts"],
    ["PPD", avgPpd.toFixed(2), "平均"],
    ["RECENT 10", recent.length ? `${recentRate.toFixed(0)}%` : "-", "上がり率"],
    ["GAMES", list.length, ""]
  ]

  return `
    <div class="z1-tiles">
      ${tiles.map(([label, value, sub]) => `
        <div class="z1-tile">
          <span class="z1-tile-label">${label}</span>
          <span class="z1-tile-value">${value}</span>
          ${sub ? `<span class="z1-tile-sub">${sub}</span>` : ""}
        </div>
      `).join("")}
    </div>
  `
}

function renderZeroOneCard(session) {

  const z = session.zeroOne
  const date = new Date(session.date)
  const dateText = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
  const result = z.finished
    ? `<span class="z1-result out">OUT · ${z.finishDarts} darts</span>`
    : `<span class="z1-result fail">NO OUT · ${z.remaining} left</span>`

  return `
    <div class="z1-card">
      <div class="z1-card-top">
        <span class="z1-card-date">${dateText}</span>
        ${result}
      </div>
      <div class="z1-card-bottom">
        <span>${formatZeroOneConfigKey(getZeroOneConfigKey(z))}</span>
        <span>PPD ${Number(session.ppd || 0).toFixed(2)}</span>
      </div>
    </div>
  `
}

// 上がるまでのダーツ数の推移。上がれなかったゲームは上の段に赤い × で出す
function drawZeroOneChart(list) {

  const canvas = document.getElementById("z1Chart")
  if (!canvas || typeof setupHiDPICanvas !== "function") return

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
