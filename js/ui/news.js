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
    },
    {
      date: "2026/09/30",
      badge: "機能追加",
      text: "設定画面にデータの書き出し・読み込み（バックアップ）を追加しました。別の端末への記録の移行にも使えます。"
    },
    {
      date: "2026/10/05",
      badge: "機能追加",
      text: "カウントアップの入力をダーツボード形式にできるようになりました。設定画面の Input Style で Board を選ぶと、刺さった場所をタップして入力できます。"
    },
    {
      date: "2026/10/06",
      badge: "機能追加",
      text: "データ画面に Analysis タブ（タグ別のスコア散布図・期間比較）を追加しました。設定画面で、カウントアップ画面の Rounds / Stats と、データ画面のタブの表示・非表示を選べます。"
    },
    {
      date: "2026/10/07",
      badge: "機能追加",
      text: "ボード入力を 2 本指で拡大（最大 4 倍）・移動できるようになりました。拡大を元に戻すタイミングは設定画面の Board Zoom で選べます。"
    },
    {
      date: "2026/10/07",
      badge: "機能追加",
      text: "カウントアップ画面で 3 本指を左にスワイプすると、最後の 1 投を取り消せるようになりました（戻るボタンと同じ）。"
    },
    {
      date: "2026/10/07",
      badge: "設定",
      text: "3 本指スワイプで戻る向き（Undo Swipe）と、ボード入力のときの戻るボタンの表示（Board Undo Button）を設定画面で選べるようになりました。"
    },
    {
      date: "2026/10/07",
      badge: "UI",
      text: "カウントアップ画面の合計スコアの右に、今のラウンドの各ダーツの得点を表示するようにしました。"
    },
    {
      date: "2026/10/07",
      badge: "保存仕様",
      text: "ゲームの記録に 1 投ごとの刺さった場所を保存するようになりました（ボード入力のときは位置も）。今後のヒートマップなどの分析に使います。"
    },
    {
      date: "2026/10/07",
      badge: "機能追加",
      text: "データ画面の Analysis タブにヒートマップを追加しました。ボード入力で入れた投の刺さった位置の分布と、よく刺さった場所の割合を表示します。"
    },
    {
      date: "2026/10/07",
      badge: "設定",
      text: "カウントアップの入力の初期値をダーツボードにしました。ボタンで入力したいときは、設定画面の Input Style で Buttons を選んでください。"
    },
    {
      date: "2026/10/07",
      badge: "UI",
      text: "サイドメニューが右からすべって出るようになり、画面の右端から左へスワイプしても開けるようになりました（右へスワイプで閉じます）。"
    },
    {
      date: "2026/10/07",
      badge: "UI",
      text: "メイン画面の更新情報を新しい 4 件にし、Android タブレットでも画面に収まるようにしました。3 本指スワイプの「戻る」が Android で効きにくいのを直しました。"
    },
    {
      date: "2026/10/07",
      badge: "機能追加",
      text: "カウントアップ画面のヘッダーに出ている今のラウンドの数字をタップすると、その 1 投を消せるようになりました。"
    },
    {
      date: "2026/10/07",
      badge: "UI",
      text: "各画面の左右の余白をそろえました。Android ではサイドメニューを開くスワイプを、画面の右端から少し内側で始めても開けるようにしました。"
    },
    {
      date: "2026/10/07",
      badge: "機能追加",
      text: "ボード入力で横向きのとき、ボードの横に空きがあれば（Rounds・Stats を非表示にしたときなど）、左下にこのゲームのヒートマップを表示するようにしました。"
    },
    {
      date: "2026/10/07",
      badge: "UI",
      text: "ゲーム画面のこのゲームのヒートマップをレーダー風のデザインにしました。"
    },
    {
      date: "2026/10/07",
      badge: "機能追加",
      text: "ボードの横に空きがあるとき、右上にラウンドスコアのグラフ、右下に Stats も表示するようにしました（左下はこのゲームのヒートマップ）。"
    },
    {
      date: "2026/10/07",
      badge: "機能追加",
      text: "ボードの横に空きがあるとき、左上にこのゲームのアワードも表示するようにしました。右上のグラフが「全体表示」ボタンと重ならないようにしました。"
    },
    {
      date: "2026/10/07",
      badge: "UI",
      text: "ゲーム画面で Input エリアだけを表示しているときは、「Input」の見出しを出さないようにしました（その分ボードが大きくなります）。"
    },
    {
      date: "2026/10/07",
      badge: "UI",
      text: "ボードを 2 本指で拡大したときは、ボードが入力エリアいっぱいに広がるようにしました（横のパネルはボードの裏に隠れます）。"
    },
    {
      date: "2026/10/08",
      badge: "修正",
      text: "Android で端末の「戻る」を使ったとき、画面の下に空白ができることがあったのを直しました。"
    },
    {
      date: "2026/10/08",
      badge: "機能追加",
      text: "設定画面のいちばん上に、画面の配置のプレビューを追加しました。入力形式や表示するエリア・タブを変えると、ゲーム画面とデータ画面のタブがどうなるかがすぐ分かります。"
    },
    {
      date: "2026/10/08",
      badge: "UI",
      text: "サイドメニューを Game・Utility などのグループに分け、今いる画面が分かるようにしました。"
    },
    {
      date: "2026/10/08",
      badge: "修正",
      text: "アップデート直後に、画面によって新しい表示と古い表示が混ざることがあったのを直しました。"
    },
    {
      date: "2026/10/08",
      badge: "新ゲーム",
      text: "01 を追加しました。301〜1501 の点数、Open / Double / Master Out、ラウンドの上限（R5〜R20）を選べます。上がり率と上がるまでのダーツ数も表示します（データ画面での 01 の記録の表示は今後対応します）。"
    },
    {
      date: "2026/10/08",
      badge: "UI",
      text: "01 でバストしたときに、画面の中央に「BUST」を表示し、ヘッダーのラウンドにも BUST / OUT を出すようにしました。"
    },
    {
      date: "2026/10/08",
      badge: "修正",
      text: "iPad などで、ボードの印（何投目か）の下に線が残って表示されることがあったのを直しました。"
    },
    {
      date: "2026/10/08",
      badge: "機能追加",
      text: "データ画面の右上で Count-Up / 01 を切り替えられるようにしました。01 では設定ごとの上がり率・上がるまでのダーツ数の推移・ゲームの一覧を見られます。"
    },
    {
      date: "2026/10/08",
      badge: "機能追加",
      text: "データ画面の 01 に、上がりナンバーの割合と、80% スタッツから出したレーティングの目安（DARTSLIVE / PHOENIX）を追加しました。"
    },
    {
      date: "2026/10/08",
      badge: "機能追加",
      text: "レンジ（ブルの中心からの距離）の目安を追加しました。データ画面の Analysis で、半分・8 割の投が入る円の半径と平均を mm で表示します。ゲーム画面のレーダーにも、このゲームの値を出します（カウントアップのみ）。"
    },
    {
      date: "2026/10/08",
      badge: "UI",
      text: "データ画面の 01 の表示を、カウントアップと同じレイアウト・デザインにそろえました（右に History、左に Stats。スマホ縦は History / Stats の切り替え）。"
    },
    {
      date: "2026/10/08",
      badge: "機能追加",
      text: "データ画面の 01 に、ブル・インナーブル・トリプルの本数と割合を追加しました。上がりナンバーのバーが全部いっぱいに見えていたのを直しました。"
    },
    {
      date: "2026/10/08",
      badge: "機能追加",
      text: "データ画面の 01 の履歴カードにも、カウントアップと同じ 20〜15 のトリプルの本数を表示するようにしました。"
    },
    {
      date: "2026/10/08",
      badge: "機能追加",
      text: "データ画面の履歴カード（カウントアップ・01）を開くと、そのゲームのヒートマップが見られるようになりました。"
    },
    {
      date: "2026/10/08",
      badge: "UI",
      text: "データ画面の履歴カードで、アワードをトリプルの下に並べるようにしました。"
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
      text: "01 の記録の分析（ラウンドごとの残り・上がりに使ったダブルなど）を増やす予定です。"
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

// 更新情報を日付の新しい順に並べる（同じ日付なら、あとに書いた方を上に）
function getUpdatesNewestFirst() {
  return INFO_CONTENT.updates
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.date.localeCompare(a.item.date) || b.index - a.index)
    .map(({ item }) => item)
}

// メイン画面の更新情報は新しい方から数件だけ出す（全件はお知らせ画面）
const MAIN_UPDATES_LIMIT = 4

function initMainInfoSections() {
  renderInfoList("mainUpdatesList", getUpdatesNewestFirst().slice(0, MAIN_UPDATES_LIMIT))

  const list = document.getElementById("mainUpdatesList")
  if (list && INFO_CONTENT.updates.length > MAIN_UPDATES_LIMIT) {
    list.insertAdjacentHTML("afterend",
      `<button type="button" class="info-more" onclick="location.href = 'news.html'">すべての更新情報（${INFO_CONTENT.updates.length} 件）</button>`)
  }
  renderInfoList("mainNoticesList", INFO_CONTENT.notice)
}

function initNewsPage() {
  const updates = getUpdatesNewestFirst()

  const allItems = [
    ...updates.map(item => ({ ...item, badge: `更新情報 / ${item.badge}` })),
    ...INFO_CONTENT.notice.map(item => ({ ...item, badge: `お知らせ / ${item.badge}` })),
    ...INFO_CONTENT.plan.map(item => ({ ...item, badge: `更新予定 / ${item.badge}` }))
  ]

  renderInfoList("allList", allItems)
  renderInfoList("updatesList", updates)
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
