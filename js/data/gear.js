// ===============================
// ===== セッティング（ダーツの道具） =====
// ===============================
// チップ・バレル・シャフト・フライトのパーツを登録し、日ごとに「その日使ったセッティング」を記録する。
//   パーツは種類ごとに名前で登録する（同じ種類・同じ名前は同じパーツ）。新しいパーツはセッティングの編集画面で入力すると登録される
//   前に使ったセッティング（4 つの組み合わせ）は日ごとの記録から並べ、押すだけでその日のセッティングにできる
// 保存：LocalStorage "dartsGear" = { parts: [{ id, type, name, createdAt }], days: { "YYYY-MM-DD": { tip, barrel, shaft, flight, updatedAt } } }
//   days の各パーツはパーツの id（未設定は ""）。バックアップ（core/backup.js）にも含める
// 編集画面はデータのトップ（data_hub.js）で選んだ日の Setting ボタンから開く（openDayGearEditor()）

const GEAR_KEY = "dartsGear"
const GEAR_TYPES = ["tip", "barrel", "shaft", "flight"]
const GEAR_LABELS = { tip: "Tip", barrel: "Barrel", shaft: "Shaft", flight: "Flight" }
const GEAR_PLACEHOLDERS = {
  tip: "例：L-style Premium Lippoint",
  barrel: "例：TIGA SONIC 2BA 18g",
  shaft: "例：Fit Shaft Gear Normal 4",
  flight: "例：Fit Flight シェイプ"
}
const GEAR_RECENT_SETS = 6

function readGear() {
  try {
    const data = JSON.parse(localStorage.getItem(GEAR_KEY) || "{}") || {}
    return {
      parts: Array.isArray(data.parts)
        ? data.parts.filter(part => part && part.id && GEAR_TYPES.includes(part.type) && typeof part.name === "string")
        : [],
      days: data.days && typeof data.days === "object" ? data.days : {}
    }
  } catch {
    return { parts: [], days: {} }
  }
}

function writeGear(data) {
  try {
    localStorage.setItem(GEAR_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

function normalizeGearName(name) {
  return String(name || "").trim().replace(/\s+/g, " ")
}

function createGearId() {
  return `g${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
}

function getGearPart(id, data = readGear()) {
  return data.parts.find(part => part.id === id) || null
}

// パーツを登録する（同じ種類・同じ名前〔大文字小文字は区別しない〕がすでにあれば、それを返す）
function addGearPart(data, type, name) {
  const clean = normalizeGearName(name)
  if (!clean || !GEAR_TYPES.includes(type)) return null
  const same = data.parts.find(part => part.type === type && part.name.toLowerCase() === clean.toLowerCase())
  if (same) return same
  const part = { id: createGearId(), type, name: clean, createdAt: Date.now() }
  data.parts.push(part)
  return part
}

// その日のセッティング（{ tip, barrel, shaft, flight } のパーツ id。なければ null）
function getDayGear(dayKey, data = readGear()) {
  const day = data.days[dayKey]
  if (!day || !GEAR_TYPES.some(type => day[type])) return null
  const result = {}
  GEAR_TYPES.forEach(type => { result[type] = day[type] && getGearPart(day[type], data) ? day[type] : "" })
  return result
}

// その日のセッティングを保存する（全部未設定なら消す）
function setDayGear(dayKey, ids) {
  const data = readGear()
  const day = {}
  GEAR_TYPES.forEach(type => { day[type] = ids && ids[type] ? ids[type] : "" })
  if (GEAR_TYPES.some(type => day[type])) {
    data.days[dayKey] = { ...day, updatedAt: Date.now() }
  } else {
    delete data.days[dayKey]
  }
  return writeGear(data)
}

// 前に使ったセッティング（組み合わせが同じ日はまとめる。最後に使った日が新しい順）
function getRecentGearSets(data = readGear(), limit = GEAR_RECENT_SETS) {
  const sets = {}
  Object.keys(data.days).sort().reverse().forEach(dayKey => {
    const ids = getDayGear(dayKey, data)
    if (!ids) return
    const key = GEAR_TYPES.map(type => ids[type]).join("|")
    if (!sets[key]) sets[key] = { ids, lastDay: dayKey, days: 0 }
    sets[key].days++
  })
  return Object.values(sets).slice(0, limit)
}

// パーツを使った日数
function countGearPartDays(id, data = readGear()) {
  return Object.values(data.days).filter(day => GEAR_TYPES.some(type => day && day[type] === id)).length
}

function renameGearPart(id, name) {
  const data = readGear()
  const part = getGearPart(id, data)
  const clean = normalizeGearName(name)
  if (!part || !clean) return false
  const same = data.parts.find(other => other.id !== id && other.type === part.type && other.name.toLowerCase() === clean.toLowerCase())
  if (same) return false
  part.name = clean
  return writeGear(data)
}

// 使った日がないパーツだけ消せる（記録の中の名前が消えないように）
function deleteGearPart(id) {
  const data = readGear()
  if (countGearPartDays(id, data)) return false
  data.parts = data.parts.filter(part => part.id !== id)
  return writeGear(data)
}

// 種類ごとのパーツ（最後に使った日が新しい順。使っていないものは登録した順に後ろ）
function getGearPartsByType(type, data = readGear()) {
  const lastUsed = {}
  Object.keys(data.days).forEach(dayKey => {
    const id = data.days[dayKey] && data.days[dayKey][type]
    if (id && (!lastUsed[id] || lastUsed[id] < dayKey)) lastUsed[id] = dayKey
  })
  return data.parts
    .filter(part => part.type === type)
    .sort((a, b) => (lastUsed[b.id] || "").localeCompare(lastUsed[a.id] || "") || a.createdAt - b.createdAt)
}

function getGearPartName(id, data = readGear()) {
  const part = id ? getGearPart(id, data) : null
  return part ? part.name : ""
}


// ===============================
// ===== 編集画面 =================
// ===============================
// 上に前に使ったセッティング（押すと 4 つに入る）、その下に 4 つのパーツ（登録済みから選ぶか「＋ New」で名前を入れる）。
// 下の「パーツの管理」で、名前の直し・使っていないパーツの削除ができる
const GEAR_NEW = "__new__"

function ensureGearModal() {
  let modal = document.getElementById("gearModal")
  if (modal) return modal

  modal = document.createElement("div")
  modal.id = "gearModal"
  modal.className = "group-note-modal gear-modal"
  modal.style.display = "none"
  modal.innerHTML = `
    <div class="group-note-dialog gear-dialog" role="dialog" aria-modal="true" aria-labelledby="gearTitle">
      <div class="group-note-header">
        <h3 id="gearTitle">Setting</h3>
        <button type="button" data-gear-close aria-label="閉じる">×</button>
      </div>
      <div id="gearRecent" class="gear-recent"></div>
      <div id="gearRows" class="gear-rows"></div>
      <div class="group-note-actions">
        <button type="button" data-gear-clear>クリア</button>
        <button type="button" data-gear-save>保存</button>
      </div>
      <details class="gear-manage">
        <summary>パーツの管理</summary>
        <div id="gearManage"></div>
      </details>
    </div>
  `
  document.body.appendChild(modal)

  modal.addEventListener("click", e => {
    const target = e.target instanceof Element ? e.target : null
    if (!target) return
    if (target === modal || target.closest("[data-gear-close]")) {
      closeDayGearEditor()
      return
    }
    const set = target.closest("[data-gear-set]")
    if (set) {
      const ids = JSON.parse(set.dataset.gearSet)
      GEAR_TYPES.forEach(type => setGearRowValue(type, ids[type] || ""))
      return
    }
    if (target.closest("[data-gear-clear]")) {
      GEAR_TYPES.forEach(type => setGearRowValue(type, ""))
      return
    }
    if (target.closest("[data-gear-save]")) {
      saveDayGearEditor()
      return
    }
    const rename = target.closest("[data-gear-rename]")
    if (rename) {
      const id = rename.dataset.gearRename
      const name = prompt("新しい名前", getGearPartName(id))
      if (name === null) return
      if (!renameGearPart(id, name)) alert("名前を変えられませんでした（空の名前や、同じ種類にある名前は使えません）")
      refreshDayGearEditor()
      return
    }
    const del = target.closest("[data-gear-delete]")
    if (del) {
      const id = del.dataset.gearDelete
      if (!confirm(`「${getGearPartName(id)}」を消しますか？`)) return
      deleteGearPart(id)
      refreshDayGearEditor()
    }
  })

  modal.addEventListener("change", e => {
    const select = e.target instanceof Element ? e.target.closest("[data-gear-select]") : null
    if (!select) return
    const input = modal.querySelector(`[data-gear-input="${select.dataset.gearSelect}"]`)
    input.hidden = select.value !== GEAR_NEW
    if (!input.hidden) input.focus()
  })

  return modal
}

function setGearRowValue(type, id) {
  const select = document.querySelector(`[data-gear-select="${type}"]`)
  const input = document.querySelector(`[data-gear-input="${type}"]`)
  if (!select) return
  select.value = id && select.querySelector(`option[value="${id}"]`) ? id : ""
  input.hidden = true
  input.value = ""
}

// 今の選択を、入力中の新しいパーツも含めて読み取る
function readGearRows() {
  const ids = {}
  const names = {}
  GEAR_TYPES.forEach(type => {
    const select = document.querySelector(`[data-gear-select="${type}"]`)
    const input = document.querySelector(`[data-gear-input="${type}"]`)
    if (select.value === GEAR_NEW) names[type] = normalizeGearName(input.value)
    else ids[type] = select.value
  })
  return { ids, names }
}

function renderGearRows(ids) {
  const data = readGear()
  document.getElementById("gearRows").innerHTML = GEAR_TYPES.map(type => `
    <div class="gear-row">
      <label class="group-note-label" for="gearSelect_${type}">${GEAR_LABELS[type]}</label>
      <select id="gearSelect_${type}" data-gear-select="${type}">
        <option value="">—（未設定）</option>
        ${getGearPartsByType(type, data).map(part => `<option value="${part.id}">${escapeHtml(part.name)}</option>`).join("")}
        <option value="${GEAR_NEW}">＋ New（新しいパーツ）</option>
      </select>
      <input type="text" data-gear-input="${type}" placeholder="${GEAR_PLACEHOLDERS[type]}" hidden />
    </div>
  `).join("")
  GEAR_TYPES.forEach(type => setGearRowValue(type, ids ? ids[type] : ""))
}

function renderGearRecent() {
  const data = readGear()
  const sets = getRecentGearSets(data)
  const box = document.getElementById("gearRecent")
  if (!sets.length) {
    box.innerHTML = '<p class="gear-empty">パーツを選ぶか、「＋ New」で新しいパーツの名前を入れてください。一度保存したセッティングは、次から上に出てワンタップで選べます。</p>'
    return
  }
  box.innerHTML = `
    <div class="group-note-label">Recent</div>
    <div class="gear-recent-list">
      ${sets.map((set, i) => `
        <button type="button" class="gear-set" data-gear-set='${JSON.stringify(set.ids)}'>
          <span class="gear-set-meta">${i === 0 ? "前回 · " : ""}${set.lastDay.slice(5).replace("-", "/")} · ${set.days} 日</span>
          ${GEAR_TYPES.map(type => `<span class="gear-set-part"><b>${GEAR_LABELS[type]}</b>${escapeHtml(getGearPartName(set.ids[type], data) || "—")}</span>`).join("")}
        </button>
      `).join("")}
    </div>
  `
}

function renderGearManage() {
  const data = readGear()
  const box = document.getElementById("gearManage")
  if (!data.parts.length) {
    box.innerHTML = '<p class="gear-empty">登録したパーツはまだありません。</p>'
    return
  }
  box.innerHTML = GEAR_TYPES.map(type => {
    const parts = getGearPartsByType(type, data)
    if (!parts.length) return ""
    return `
      <div class="gear-manage-type">${GEAR_LABELS[type]}</div>
      ${parts.map(part => {
        const days = countGearPartDays(part.id, data)
        return `
          <div class="gear-manage-row">
            <span class="gear-manage-name">${escapeHtml(part.name)}</span>
            <span class="gear-manage-days">${days} 日</span>
            <button type="button" data-gear-rename="${part.id}">名前</button>
            <button type="button" data-gear-delete="${part.id}" ${days ? "disabled title=\"使った日があるパーツは消せません\"" : ""}>削除</button>
          </div>
        `
      }).join("")}
    `
  }).join("")
}

// パーツの名前を直したり消したりしたあと、選んでいる途中の内容を保ったまま描き直す
function refreshDayGearEditor() {
  const { ids } = readGearRows()
  renderGearRecent()
  renderGearRows(ids)
  renderGearManage()
}

function openDayGearEditor(dayKey, label) {
  const modal = ensureGearModal()
  modal.dataset.dayKey = dayKey
  document.getElementById("gearTitle").textContent = `${label} Setting`
  renderGearRecent()
  renderGearRows(getDayGear(dayKey))
  renderGearManage()
  modal.querySelector(".gear-manage").open = false
  modal.style.display = "flex"
}

function closeDayGearEditor() {
  const modal = document.getElementById("gearModal")
  if (modal) modal.style.display = "none"
}

function saveDayGearEditor() {
  const modal = document.getElementById("gearModal")
  const dayKey = modal.dataset.dayKey
  const { ids, names } = readGearRows()

  if (Object.keys(names).some(type => !names[type])) {
    alert("新しいパーツの名前を入れてください")
    return
  }

  // 新しいパーツを登録してから、その日のセッティングにする
  const data = readGear()
  Object.keys(names).forEach(type => {
    const part = addGearPart(data, type, names[type])
    ids[type] = part ? part.id : ""
  })
  if (!writeGear(data) || !setDayGear(dayKey, ids)) {
    alert("保存できる容量がいっぱいで、セッティングを保存できませんでした。")
    return
  }

  closeDayGearEditor()
  if (typeof dataHubOpen !== "undefined" && dataHubOpen && typeof renderDataHub === "function") renderDataHub()
}
