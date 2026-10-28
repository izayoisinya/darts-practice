// ===============================
// ===== 日別メモ ==================
// ===============================
// 日ごとのメモ（コメント・タグ・セッティング画像）の読み書きと、編集画面（data.html の #groupNoteModal）。
// 編集画面はデータのトップのカレンダーで選んだ日の「Memo」から開く（data_hub.js）。
// タグは History・Stats の Tag Search の絞り込み（data_loader.js）と、タグ別の散布図（data.js）で使う。
// 2026.10.10 に、お休みしていた Day / Week / Month / Year のビュー（もとの data_grouped.js / data_detail.js）を削除し、メモの部分だけ残した
const GROUP_NOTE_KEY = "dartsDayNotesV2"
let groupNoteEditingImage = null

// メモの写真は縮めて保存する（LocalStorage は全部で 5MB 前後しか入らず、撮ったままの写真だと数枚であふれるため）。
// 長い辺を NOTE_IMAGE_MAX_SIDE px 以下にし、JPEG にする（1 枚 100〜200KB 程度）
const NOTE_IMAGE_MAX_SIDE = 1280
const NOTE_IMAGE_QUALITY = 0.8
// 細かい写真で大きくなったときは、この大きさに収まるまで画質を下げる（0.8 → 0.65 → 0.5）
const NOTE_IMAGE_TARGET = 350 * 1024
// これより大きい写真（保存済みのもの）は、データ画面を開いたときに縮め直す
const NOTE_IMAGE_SHRINK_OVER = 400 * 1024

function getAllDayNotes() {
  const notes = JSON.parse(localStorage.getItem(GROUP_NOTE_KEY) || "{}")
  // 旧形式(mode別)のうちdayだけは読めるように後方互換
  if (notes && notes.day && typeof notes.day === "object") {
    return notes.day
  }
  return notes || {}
}

// 保存できたら true。容量がいっぱいなどで保存できなければ false（呼ぶ側で知らせる）
function saveAllDayNotes(notes) {
  try {
    localStorage.setItem(GROUP_NOTE_KEY, JSON.stringify(notes))
    return true
  } catch {
    return false
  }
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
  return saveAllDayNotes(notes)
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
    groupNoteEditingImage = await shrinkImageToDataUrl(await fileToDataUrl(file))
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

    const saved = setDayNote(dayKey, {
      comment,
      tags,
      imageData: groupNoteEditingImage || ""
    })
    if (!saved) {
      // 編集画面は閉じずに残す（書いた内容を失わないように）
      alert("保存できる容量がいっぱいで、メモを保存できませんでした。\nほかの日のメモの写真を外すと空きができます。")
      return
    }

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


// ===============================
// ===== 写真を縮める ===============
// ===============================
// 画像（data URL）を、長い辺 NOTE_IMAGE_MAX_SIDE px 以下の JPEG にする。
// 読めない形式（ブラウザが表示できない画像）や、縮めても小さくならないときは元のまま返す
function shrinkImageToDataUrl(dataUrl) {
  return new Promise(resolve => {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      resolve(dataUrl)
      return
    }
    const img = new Image()
    img.onload = () => {
      try {
        const scale = Math.min(1, NOTE_IMAGE_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
        const width = Math.max(1, Math.round(img.naturalWidth * scale))
        const height = Math.max(1, Math.round(img.naturalHeight * scale))
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        // 透過のある画像（PNG）は JPEG にすると黒くなるので、背景を塗っておく
        ctx.fillStyle = "#11151c"
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        let shrunk = canvas.toDataURL("image/jpeg", NOTE_IMAGE_QUALITY)
        for (const quality of [0.65, 0.5]) {
          if (shrunk.length <= NOTE_IMAGE_TARGET) break
          shrunk = canvas.toDataURL("image/jpeg", quality)
        }
        resolve(shrunk.length < dataUrl.length ? shrunk : dataUrl)
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

// 前の版で撮ったままの大きさで保存した写真を縮め直して、空きを作る（データ画面を開いたときに 1 回）
async function shrinkStoredNoteImages() {
  const notes = getAllDayNotes()
  let changed = false
  for (const key of Object.keys(notes)) {
    const image = notes[key] && notes[key].imageData
    if (typeof image !== "string" || image.length < NOTE_IMAGE_SHRINK_OVER) continue
    const shrunk = await shrinkImageToDataUrl(image)
    if (shrunk.length < image.length) {
      notes[key] = { ...notes[key], imageData: shrunk }
      changed = true
    }
  }
  if (changed && saveAllDayNotes(notes) && typeof dataHubOpen !== "undefined" && dataHubOpen) renderDataHub()
}

