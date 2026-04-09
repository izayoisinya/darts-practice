const INFO_CONTENT = {
  updates: [
    {
      date: "2026/04/09",
      badge: "機能改善",
      text: "データ保存を IndexedDB 優先に変更し、保存容量を拡張しました。"
    },
    {
      date: "2026/04/09",
      badge: "UI",
      text: "設定画面に保存状況（件数・保存先・容量概算）を追加しました。"
    },
    {
      date: "2026/04/10",
      badge: "UI",
      text: "メインメニューに更新情報/お知らせブロックを追加しました。"
    }
  ],
  notice: [
    {
      date: "案内",
      badge: "ベータ準備",
      text: "現在ベータ公開に向けた最終調整中です。表示崩れや操作しにくい箇所の報告を歓迎します。"
    },
    {
      date: "注意",
      badge: "保存仕様",
      text: "保存容量は端末とブラウザにより差があります。重要データは定期的なバックアップを推奨します。"
    }
  ],
  plan: [
    {
      date: "予定",
      badge: "01",
      text: "01ゲームを追加予定です。"
    },
    {
      date: "予定",
      badge: "クリケ",
      text: "クリケットモードを追加予定です。"
    }
  ]
}

function createInfoItemHtml(item) {
  return `
    <li class="info-item info-card">
      <div class="info-head">
        <span class="info-date">${item.date}</span>
        <span class="info-badge">${item.badge}</span>
      </div>
      <p class="info-text">${item.text}</p>
    </li>
  `
}

function renderInfoList(targetId, items) {
  const el = document.getElementById(targetId)
  if (!el) return
  const safeItems = Array.isArray(items) ? items : []
  el.innerHTML = safeItems.map(createInfoItemHtml).join("")
}

function switchInfoTab(target) {
  const tabs = document.querySelectorAll(".info-tabs button")
  const panels = document.querySelectorAll(".tab-panel")

  tabs.forEach(tab => {
    const active = tab.dataset.tab === target
    tab.classList.toggle("active", active)
    tab.setAttribute("aria-selected", active ? "true" : "false")
  })

  panels.forEach(panel => {
    const active = panel.dataset.panel === target
    panel.classList.toggle("active", active)
    if (active) panel.removeAttribute("hidden")
    else panel.setAttribute("hidden", "hidden")
  })
}

function initMainInfoSections() {
  renderInfoList("mainUpdatesList", INFO_CONTENT.updates)
  renderInfoList("mainNoticesList", INFO_CONTENT.notice)
}

function initNewsPage() {
  const allItems = [
    ...INFO_CONTENT.updates.map(item => ({ ...item, badge: `更新情報 / ${item.badge}` })),
    ...INFO_CONTENT.notice.map(item => ({ ...item, badge: `お知らせ / ${item.badge}` })),
    ...INFO_CONTENT.plan.map(item => ({ ...item, badge: `更新予定 / ${item.badge}` }))
  ]

  renderInfoList("allList", allItems)
  renderInfoList("updatesList", INFO_CONTENT.updates)
  renderInfoList("noticeList", INFO_CONTENT.notice)
  renderInfoList("planList", INFO_CONTENT.plan)

  const tabs = document.querySelectorAll(".info-tabs button")
  if (!tabs.length) return

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      switchInfoTab(tab.dataset.tab)
    })
  })

  switchInfoTab("all")
}

document.addEventListener("DOMContentLoaded", () => {
  initMainInfoSections()
  initNewsPage()
})
