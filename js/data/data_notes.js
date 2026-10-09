// ===============================
// ===== 日別メモ ==================
// ===============================
// 日ごとのメモ（コメント・タグ・セッティング画像）の読み書きと、編集画面（data.html の #groupNoteModal）。
// 編集画面はデータのトップのカレンダーで選んだ日の「Memo」から開く（data_hub.js）。
// タグは History・Stats の Tag Search の絞り込み（data_loader.js）と、タグ別の散布図（data.js）で使う。
// 2026.10.10 に、お休みしていた Day / Week / Month / Year のビュー（もとの data_grouped.js / data_detail.js）を削除し、メモの部分だけ残した
const GROUP_NOTE_KEY = "dartsDayNotesV2"
let groupNoteEditingImage = null

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
    // データのトップ（カレンダーで選んだ日）を描き直す
    if (typeof dataHubOpen !== "undefined" && dataHubOpen) renderDataHub()
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
