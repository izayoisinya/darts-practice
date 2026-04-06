// ============================================
// グループビュー用ページネーション
// ============================================
const GROUP_NOTE_KEY = "dartsDayNotesV2"
let groupNoteEditingImage = null
let selectedDayTagFilter = ""

// カレンダータップで日付ジャンプしたときの元モード保存
let calendarJumpOriginMode = null
let calendarJumpOriginData = null
let calendarJumpOriginPage = null

function jumpToCalendarDay(dateStr) {
  const sessions = JSON.parse(localStorage.getItem("dartsSessions") || "[]")
  const groups = groupSessions(sessions, "day")
  const dayList = groups[dateStr] || []
  if (!dayList.length) return

  calendarJumpOriginMode = groupedPageMode
  calendarJumpOriginData = groupedPageData
  calendarJumpOriginPage = groupedPageNumber

  groupedPageMode = "day"
  groupedPageData = [[dateStr, dayList]]
  groupedPageNumber = 1

  showGameDetails(dateStr, dayList)
}

function getFilteredGroupedEntries(mode, entries) {
  if (mode !== "day" || !selectedDayTagFilter) return entries

  return (entries || []).filter(([dayKey]) => {
    const tags = getDayNote(dayKey).tags || []
    return tags.includes(selectedDayTagFilter)
  })
}

function toggleDayTagFilter(tag) {
  if (groupedPageMode !== "day") return
  const normalized = String(tag || "").trim().replace(/^#/, "")
  selectedDayTagFilter = selectedDayTagFilter === normalized ? "" : normalized
  groupedPageNumber = 1
  displayGroupedPage(groupedPageMode, groupedPageData)
}

function renderGroupedPaginated(mode) {
  
  const sessions = JSON.parse(
    localStorage.getItem("dartsSessions")
  ) || []
  
  const container = document.getElementById("sessionsContainer")
  container.innerHTML = ""
  
  const groups = groupSessions(sessions, mode)
  const sortedEntries = Object.entries(groups)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
  
  groupedPageMode = mode
  groupedPageData = sortedEntries
  groupedPageNumber = 1
  
  displayGroupedPage(mode, sortedEntries)
}

function displayGroupedPage(mode, sortedEntries) {
  ensureGroupNoteModalWired()
  const filteredEntries = getFilteredGroupedEntries(mode, sortedEntries)
  
  const container = document.getElementById("sessionsContainer")
  container.innerHTML = ""
  
  const PAGE_SIZE = 10
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE))
  if (groupedPageNumber > totalPages) groupedPageNumber = totalPages
  const start = (groupedPageNumber - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  
  const pageData = filteredEntries.slice(start, end)

  updateGroupedLeftCalendar(mode, sortedEntries, pageData)

  if (filteredEntries.length === 0) {
    container.innerHTML = `<p>タグ「#${escapeHtml(selectedDayTagFilter)}」に一致するデータはありません</p>`
    renderGroupedPagination(filteredEntries.length)
    return
  }
  
  // グループカードを表示
  pageData.forEach(([key, list]) => {
    
    const summary = calcSummary(list)
    
    let label = key
    
    if (mode === "week") {
      const { start, end } = getWeekRange(new Date(key))
      label = `${formatShort(start)}〜${formatShort(end, false)}`
    }
    
    if (mode === "month") {
      const [y, m] = key.split("-")
      label = `${y}/${m}`
    }
    
    if (mode === "year") {
      label = `${key}年`
    }

    const dayKeys = getDayKeysFromSessions(list)
    const noteInfo = buildGroupNotePreview(mode, key, dayKeys)
    const tagChips = (noteInfo.tags || [])
      .slice(0, 4)
      .map(t => `<span class="group-note-chip">#${escapeHtml(t)}</span>`)
      .join("")
    const commentPreview = noteInfo.comment ? escapeHtml(noteInfo.comment).slice(0, 80) : ""
    const imageBadge = noteInfo.hasImage ? '<span class="group-note-image-badge">IMG</span>' : ''
    
    const div = document.createElement("div")
    div.className = "group-card"
    div.innerHTML = `
      <div class="group-card-header">
        <span class="group-card-label">${label}</span>
        <div class="group-card-header-right">
          ${imageBadge}
          <span class="group-card-games">${summary.games} Games</span>
          ${mode === "day" ? '<button class="group-note-edit-btn" type="button">Memo</button>' : ""}
        </div>
      </div>
      <div class="group-card-body">
        <div class="group-kpi-item">
          <span class="group-kpi-label">Avg Score</span>
          <span class="group-kpi-value">${summary.avgScore}</span>
        </div>
        <div class="group-kpi-item">
          <span class="group-kpi-label">Avg PPD</span>
          <span class="group-kpi-value">${summary.avgPPD}</span>
        </div>
        <div class="group-kpi-item">
          <span class="group-kpi-label">Bulls</span>
          <span class="group-kpi-value">${summary.totalBulls}</span>
        </div>
      </div>
      ${commentPreview || tagChips ? `<div class="group-note-preview"><div class="group-note-preview-text">${commentPreview}</div><div class="group-note-chip-row">${tagChips}</div></div>` : ""}
    `
    div.onclick = () => showGameDetails(key, list)
    const memoBtn = div.querySelector(".group-note-edit-btn")
    if (memoBtn) {
      memoBtn.onclick = ev => {
        ev.stopPropagation()
        openDayNoteEditor(key, label)
      }
    }
    container.appendChild(div)
  })
  
  // ページネーション表示
  renderGroupedPagination(filteredEntries.length)
}

function renderGroupedPagination(total) {
  const PAGE_SIZE = 10
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  
  document.getElementById('pageInfo').textContent = 
    `${groupedPageNumber} / ${totalPages}`
  
  document.getElementById('prevBtn').disabled = groupedPageNumber === 1
  document.getElementById('nextBtn').disabled = groupedPageNumber === totalPages
}


function changeGroupedPage(page) {
  const filteredEntries = getFilteredGroupedEntries(groupedPageMode, groupedPageData)
  const PAGE_SIZE = 10
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE))
  
  if (page < 1 || page > totalPages) return
  
  groupedPageNumber = page
  displayGroupedPage(groupedPageMode, groupedPageData)
}

// グループビュー（Day/Week/Month/Year）を表示する際に呼び出す
function displayGroupView(mode) {
  groupedPageMode = mode
  groupedPageNumber = 1
  if (mode !== "day") selectedDayTagFilter = ""
  
  const sessions = JSON.parse(
    localStorage.getItem("dartsSessions")
  ) || []
  
  // モードに応じたグループ化
  const groups = groupSessions(sessions, mode)
  const sortedEntries = Object.entries(groups)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
  
  groupedPageData = sortedEntries
  
  // ページネーションを更新
  if (groupedPageData && groupedPageData.length > 0) {
    renderGroupedPagination(groupedPageData.length)
    displayGroupedPage(mode, groupedPageData)
  } else {
    const calendarContainer = document.getElementById("calendarContainer")
    if (calendarContainer) {
      calendarContainer.style.display = "none"
      calendarContainer.innerHTML = ""
    }
  }
}

function updateGroupedLeftCalendar(mode, allEntries, pageData) {
  const calendarContainer = document.getElementById("calendarContainer")
  if (!calendarContainer) return

  if (!allEntries || allEntries.length === 0 || !pageData || pageData.length === 0) {
    calendarContainer.style.display = "none"
    calendarContainer.innerHTML = ""
    return
  }

  const gameDates = {}
  allEntries.forEach(([, list]) => {
    ;(list || []).forEach(g => {
      if (!g || !g.date) return
      const d = new Date(g.date)
      if (Number.isNaN(d.getTime())) return
      const key = getLocalDateKey(d)
      gameDates[key] = (gameDates[key] || 0) + 1
    })
  })

  calendarContainer.style.display = "block"

  if (mode === "year") {
    const years = [...new Set(
      allEntries
        .map(([key]) => parseInt(key, 10))
        .filter(year => !Number.isNaN(year))
    )].sort((a, b) => a - b)
    const currentYears = new Set(
      pageData
        .map(([key]) => parseInt(key, 10))
        .filter(year => !Number.isNaN(year))
    )

    if (typeof renderYearCalendar === "function" && years.length) {
      const cal = years
        .map(year => `
          <div class="group-cal-block${currentYears.has(year) ? " is-current-page" : ""}">
            ${renderYearCalendar(year, gameDates)}
          </div>
        `)
        .join("")
      const stats = renderTagStats(mode, pageData)
      calendarContainer.innerHTML = `<div class="group-cal-scroll">${cal}</div>${stats}`
      scrollGroupedCalendarToCurrent(calendarContainer)
    } else {
      calendarContainer.innerHTML = ""
    }
    return
  }

  const highlightSet = new Set()
  if (mode === "day") {
    pageData.forEach(([key]) => highlightSet.add(key))
  }
  if (mode === "week") {
    pageData.forEach(([key]) => {
      const { start } = getWeekRange(new Date(key))
      for (let i = 0; i < 7; i++) {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        highlightSet.add(getLocalDateKey(d))
      }
    })
  }
  if (mode === "month") {
    pageData.forEach(([key]) => {
      const parts = key.split("-")
      const y = parseInt(parts[0], 10)
      const m = parseInt(parts[1], 10)
      if (Number.isNaN(y) || Number.isNaN(m)) return
      const lastDay = new Date(y, m, 0).getDate()
      for (let d = 1; d <= lastDay; d++) {
        highlightSet.add(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`)
      }
    })
  }

  const monthKeys = [...new Set(Object.keys(gameDates).map(key => key.slice(0, 7)))]
    .sort((a, b) => a.localeCompare(b))

  const cal = monthKeys
    .map(monthKey => {
      const parts = monthKey.split("-")
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10)
      if (Number.isNaN(year) || Number.isNaN(month)) return ""

      const lastDay = new Date(year, month, 0).getDate()
      let hasCurrentPageRange = false
      for (let d = 1; d <= lastDay; d++) {
        const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
        if (highlightSet.has(dateKey)) {
          hasCurrentPageRange = true
          break
        }
      }

      return `
        <div class="group-cal-block${hasCurrentPageRange ? " is-current-page" : ""}">
          ${renderGroupedMonthCalendar(year, month, highlightSet, gameDates)}
        </div>
      `
    })
    .join("")

  const stats = renderTagStats(mode, pageData)
  calendarContainer.innerHTML = `<div class="group-cal-scroll">${cal}</div>${stats}`
  scrollGroupedCalendarToCurrent(calendarContainer)
}

function scrollGroupedCalendarToCurrent(calendarContainer) {
  const scrollEl = calendarContainer?.querySelector(".group-cal-scroll")
  if (!scrollEl) return

  requestAnimationFrame(() => {
    const target = scrollEl.querySelector(".group-cal-block.is-current-page")
    if (!target) return

    const targetTop = target.offsetTop - scrollEl.offsetTop
    scrollEl.scrollTop = Math.max(0, targetTop - 8)
  })
}

function renderGroupedMonthCalendar(year, month, highlightSet, gameDates) {
  const dayLabels = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

  const firstDate = new Date(year, month - 1, 1)
  let startOffset = firstDate.getDay()
  startOffset = startOffset === 0 ? 6 : startOffset - 1

  const daysInMonth = new Date(year, month, 0).getDate()
  let cells = dayLabels.map(d => `<div class="cal-header-day">${d}</div>`).join("")

  for (let i = 0; i < startOffset; i++) {
    cells += '<div class="cal-day cal-empty"></div>'
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    const inRange = highlightSet.has(dateStr)
    const hasGames = (gameDates[dateStr] || 0) > 0
    let cls = "cal-day"
    if (inRange) cls += " cal-highlight"
    if (hasGames && !inRange) cls += " cal-has-games"
    const dot = hasGames ? '<span class="cal-dot"></span>' : ""
    const onclick = hasGames ? ` onclick="jumpToCalendarDay('${dateStr}')"` : ""
    cells += `<div class="${cls}"${onclick}><span class="cal-day-num">${d}</span>${dot}</div>`
  }

  return `<div class="cal-wrap"><div class="cal-title">${year}年${month}月</div><div class="cal-grid">${cells}</div></div>`
}

function getAllDayNotes() {
  const notes = JSON.parse(localStorage.getItem(GROUP_NOTE_KEY) || "{}")
  // 旧形式(mode別)のうちdayだけは読めるように後方互換
  if (notes && notes.day && typeof notes.day === "object") {
    return notes.day
  }
  return notes || {}
}

function saveAllDayNotes(notes) {
  localStorage.setItem(GROUP_NOTE_KEY, JSON.stringify(notes))
}

function getDayNote(dayKey) {
  const notes = getAllDayNotes()
  return notes[dayKey] || { comment: "", tags: [], imageData: "" }
}

function setDayNote(dayKey, note) {
  const notes = getAllDayNotes()
  notes[dayKey] = {
    comment: note.comment || "",
    tags: note.tags || [],
    imageData: note.imageData || "",
    updatedAt: Date.now()
  }
  saveAllDayNotes(notes)
}

function getDayKeysFromSessions(list) {
  const set = new Set()
  ;(list || []).forEach(s => {
    if (!s || !s.date) return
    const d = new Date(s.date)
    if (Number.isNaN(d.getTime())) return
    set.add(getLocalDateKey(d))
  })
  return [...set].sort()
}

function buildGroupNotePreview(mode, key, dayKeys) {
  if (mode === "day") {
    const note = getDayNote(key)
    return {
      comment: note.comment || "",
      tags: note.tags || [],
      hasImage: !!note.imageData
    }
  }

  const comments = []
  const tags = new Set()
  let hasImage = false
  let noteCount = 0

  ;(dayKeys || []).forEach(dayKey => {
    const note = getDayNote(dayKey)
    if (note.comment || (note.tags || []).length || note.imageData) {
      noteCount++
    }
    if (note.comment) comments.push(note.comment)
    ;(note.tags || []).forEach(t => tags.add(t))
    if (note.imageData) hasImage = true
  })

  return {
    comment: noteCount ? `配下Dayメモ: ${noteCount}件` : "",
    tags: [...tags],
    hasImage
  }
}

function parseTags(raw) {
  return [...new Set((raw || "")
    .split(/[\s,、，]+/)
    .map(t => t.trim().replace(/^#/, ""))
    .filter(Boolean))]
}

function getUsedTagsForSuggestions() {
  const notes = getAllDayNotes()
  const counts = {}

  Object.values(notes || {}).forEach(note => {
    ;(note?.tags || []).forEach(tag => {
      const normalized = String(tag || "").trim().replace(/^#/, "")
      if (!normalized) return
      counts[normalized] = (counts[normalized] || 0) + 1
    })
  })

  return Object.entries(counts)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return a[0].localeCompare(b[0], "ja")
    })
    .map(([tag]) => tag)
}

function renderGroupNoteTagSuggestions() {
  const wrap = document.getElementById("groupNoteTagSuggestions")
  const input = document.getElementById("groupNoteTags")
  if (!wrap || !input) return

  const usedTags = getUsedTagsForSuggestions()
  if (!usedTags.length) {
    wrap.style.display = "none"
    wrap.innerHTML = ""
    return
  }

  const selected = new Set(parseTags(input.value))
  const chips = usedTags
    .map(tag => `
      <button
        type="button"
        class="group-note-suggest-chip${selected.has(tag) ? " is-selected" : ""}"
        data-tag="${escapeHtml(tag)}"
      >#${escapeHtml(tag)}</button>
    `)
    .join("")

  wrap.innerHTML = `
    <div class="group-note-suggest-title">Used Tags</div>
    <div class="group-note-suggest-row">${chips}</div>
  `
  wrap.style.display = "block"

  wrap.querySelectorAll(".group-note-suggest-chip").forEach(btn => {
    btn.onclick = () => {
      const tag = btn.dataset.tag || ""
      if (!tag) return

      const next = new Set(parseTags(input.value))
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)

      input.value = [...next].join(", ")
      renderGroupNoteTagSuggestions()
      input.focus()
    }
  })

  input.oninput = () => renderGroupNoteTagSuggestions()
}

function extractHashTags(comment) {
  const matches = String(comment || "").match(/#([^\s#.,、，]+)/g) || []
  return [...new Set(matches.map(m => m.replace(/^#/, "").trim()).filter(Boolean))]
}

function renderTagStats(mode, pageData) {
  const counts = {}
  ;(pageData || []).forEach(([key, list]) => {
    const dayKeys = mode === "day" ? [key] : getDayKeysFromSessions(list)
    dayKeys.forEach(dayKey => {
      const note = getDayNote(dayKey)
      ;(note.tags || []).forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1
      })
    })
  })
  const rows = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  if (!rows.length) {
    return '<div class="tag-stats-card"><div class="tag-stats-title">Tag Stats</div><div class="tag-stats-empty">タグはまだありません</div></div>'
  }

  const selectedLabel = selectedDayTagFilter
    ? `<button type="button" class="tag-stats-clear-btn" onclick="toggleDayTagFilter('')">Clear: #${escapeHtml(selectedDayTagFilter)}</button>`
    : ""

  const items = rows
    .map(([tag, count]) => {
      const encoded = encodeURIComponent(tag)
      const active = mode === "day" && selectedDayTagFilter === tag ? " is-active" : ""
      return `<button type="button" class="tag-stats-row tag-stats-filter-btn${active}" onclick="toggleDayTagFilter(decodeURIComponent('${encoded}'))"><span>#${escapeHtml(tag)}</span><strong>${count}</strong></button>`
    })
    .join("")
  return `<div class="tag-stats-card"><div class="tag-stats-title">Tag Stats</div>${selectedLabel}${items}</div>`
}

function ensureGroupNoteModalWired() {
  const modal = document.getElementById("groupNoteModal")
  if (!modal || modal.dataset.wired === "1") return

  const closeBtn = document.getElementById("groupNoteCloseBtn")
  const saveBtn = document.getElementById("groupNoteSaveBtn")
  const deleteImageBtn = document.getElementById("groupNoteDeleteImageBtn")
  const imageInput = document.getElementById("groupNoteImageInput")

  closeBtn.onclick = closeGroupNoteEditor
  modal.onclick = ev => {
    if (ev.target === modal) closeGroupNoteEditor()
  }

  deleteImageBtn.onclick = () => {
    groupNoteEditingImage = ""
    const preview = document.getElementById("groupNotePreview")
    preview.style.display = "none"
    preview.src = ""
    imageInput.value = ""
  }

  imageInput.onchange = async ev => {
    const file = ev.target.files && ev.target.files[0]
    if (!file) return
    groupNoteEditingImage = await fileToDataUrl(file)
    const preview = document.getElementById("groupNotePreview")
    preview.src = groupNoteEditingImage
    preview.style.display = "block"
  }

  saveBtn.onclick = () => {
    const dayKey = modal.dataset.dayKey
    if (!dayKey) return

    const comment = document.getElementById("groupNoteComment").value.trim()
    const tagInput = document.getElementById("groupNoteTags").value
    const tags = [...new Set([...parseTags(tagInput), ...extractHashTags(comment)])]

    setDayNote(dayKey, {
      comment,
      tags,
      imageData: groupNoteEditingImage || ""
    })

    closeGroupNoteEditor()
    displayGroupedPage(groupedPageMode, groupedPageData)
  }

  modal.dataset.wired = "1"
}

function openDayNoteEditor(dayKey, label) {
  ensureGroupNoteModalWired()
  const modal = document.getElementById("groupNoteModal")
  const title = document.getElementById("groupNoteTitle")
  const comment = document.getElementById("groupNoteComment")
  const tags = document.getElementById("groupNoteTags")
  const preview = document.getElementById("groupNotePreview")
  const imageInput = document.getElementById("groupNoteImageInput")

  const note = getDayNote(dayKey)

  modal.dataset.dayKey = dayKey
  title.textContent = `${label} Memo`
  comment.value = note.comment || ""
  tags.value = (note.tags || []).join(", ")
  renderGroupNoteTagSuggestions()
  groupNoteEditingImage = note.imageData || ""
  imageInput.value = ""

  if (groupNoteEditingImage) {
    preview.src = groupNoteEditingImage
    preview.style.display = "block"
  } else {
    preview.src = ""
    preview.style.display = "none"
  }

  modal.style.display = "flex"
}

function closeGroupNoteEditor() {
  const modal = document.getElementById("groupNoteModal")
  if (!modal) return
  modal.style.display = "none"
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}
