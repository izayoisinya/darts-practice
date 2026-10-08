# CLAUDE.md

ダーツの自宅練習のスコアを記録・表示・分析する Web アプリ（PWA）。
対戦ではなく練習分析に特化。個人用だが一般公開も視野に入れている。

- 回答・コミットメッセージ・UI 上の説明文は日本語でよい（UI のラベルは英語が基本：History / Stats / Awards など）
- 仕様の原典：`Darts Practice App 仕様書 v01.text`（機能仕様）
- 内部設計書：`docs/design.md`。構成・関数・データ形式を変えたら設計書も合わせて更新する（画面が大きく変わったら `docs/images/` の画像も撮り直す）

## 作業の流れ（Git）

- 作業が終わったらmainにマージしてプッシュする

## 技術構成

- 素の HTML / CSS / JavaScript。フレームワーク・ビルド・npm・テストは無い
- ES Modules は使わず、各 HTML が `<script defer>` で JS を順に読み込む。関数・変数はすべてグローバル
  - 読み込み順：`core/`（state → core → storage）→ 画面ごとの JS → 最後に `init/main.js`
  - 新しい JS を追加したら、使う HTML すべてに `<script>` を追加し、依存より後に置くこと
- グラフは Canvas に直接描画（外部ライブラリなし）
- 動作確認：`python3 -m http.server 8000` で配信してブラウザ（Chromium / Playwright）で開く

## 対象端末

- 主な利用環境：iPad Pro 11inch の**横画面**
- 一般公開時はスマホ利用が多い想定なので、スマホ縦・横でも崩れないこと
- テスト端末に iPhone 7 / iPhone XR など古い iOS Safari も含む。新しすぎる JS/CSS 機能は避ける
- 画面の左右の余白は `base.css` の `--gutter-left` / `--gutter-right` を使い、左右同じにする（左右の安全領域もこれに含まれる）
- 画面上部の安全領域は `env(safe-area-inset-top)` を直接使わず `base.css` の `--safe-top` を使う（iOS のホーム画面アプリでは上端のぼかしの分だけ余分に下げている）
- 端末判定は `core.js` の `detectDevice()` が `body` に `phone` / `tablet` / `desktop` と `portrait` / `landscape` クラスを付与し、`css/responsive/*.css` がそれを見て切り替える（メディアクエリより body クラスが基本）

## ディレクトリと責務

```
index.html      メインメニュー（ゲーム選択 / Data / Settings / Info）
countup.html    COUNT-UP ゲーム画面（Rounds / Input / Stats の 3 エリア）。?game=01 で 01、?game=cricket でクリケット（同じ画面を GAME_TYPE で切り替え）
data.html       スコア記録データの表示（Statistics）
settings.html   設定（入力形式: buttons / board、ブルモード: fat / double、ボードの大きさ: soft / steel、表示エリア・データタブの表示/非表示、画面向き、ストレージ状況）
news.html       お知らせ
sw.js           Service Worker（プリキャッシュ）
manifest.json   PWA マニフェスト
```

### JavaScript（`js/`）

| フォルダ | ファイル | 責務 |
| --- | --- | --- |
| core/ | state.js | グローバル変数・定数のみ（`TOTAL_ROUNDS`, `game`, `sessions`, `bullMode` など）。**関数は書かない** |
| core/ | core.js | 全画面共通：`detectDevice()`, `refreshLayout()`, `setupLinks()`, サイドメニューの中身（`renderSideMenu()`。メニューの項目は `SIDE_MENU_GROUPS` だけ直す。各 HTML には空の `#sideMenu` だけ置く） |
| core/ | storage.js | 永続化のみ。**ビジネスロジックを入れない・他モジュールに依存しない** |
| core/ | backup.js | バックアップの書き出し・読み込み（ゲーム記録と日別メモの JSON 化・取り込み）。DOM 操作なし（UI は settings.js） |
| init/ | main.js | 初期化（`initApp()`）、イベント登録（`registerEvents()`）、SW 登録、メニュー画面のサマリー |
| game/ | game_core.js | ゲーム共通ロジック（次ゲーム、Undo、終了判定、リセット）。UI 生成は含まない |
| game/ | game_countup.js | COUNT-UP 固有ロジック（`initGame()`, `addDart()`）。UI 生成は含まない。01 もこの流れを使う |
| game/ | game_01.js | 01 のルール（バスト・上がり・残りの計算 `computeZeroOne()`、次に入れる場所 `syncZeroOnePosition()`、設定、上がり率の集計）。UI 生成は含まない |
| game/ | game_cricket.js | クリケットのルール（マーク・点・クローズの計算 `computeCricket()`、MPR、アワード、設定、成績の集計、保存する履歴 `createCricketSession()`）。UI 生成は含まない。次に入れる場所は 01 と共通の `game_core.js` の `syncPositionFromState()` |
| game/ | cu_ui.js | COUNT-UP の UI 生成・DOM 操作 |
| game/ | board_input.js | ボード形式の入力（ダーツボードの SVG 生成・タップ位置の判定）。設定 `inputMode` が `"board"` のとき `createNumberTable()` から使う |
| game/ | stats.js | スタッツ・アワード計算。**UI 表示・DOM 操作は含まない**（再利用できる形にする） |
| data/ | data_loader.js | セッション読込・グループ化・集計・ページネーション、`initDataPage()` |
| data/ | data.js | データ画面の統括（ビュー切替、タブの表示/非表示、Stats/Awards 表示、グラフ、Analysis：タグ別散布図・期間比較） |
| data/ | data_grouped.js | Day/Week/Month/Year のグループビュー、日別メモ・タグ（今は一旦お休み。データ画面は Games と Analysis だけで、`data.js` の `DATA_VIEW_TABS` に足せば戻せる） |
| data/ | data_detail.js | グループ内のゲーム一覧（詳細ビュー）、カレンダー、比較 |
| data/ | heatmap.js | Analysis タブのヒートマップ（1 投ごとの記録から刺さった位置の分布・よく刺さった場所の割合）。描画の `paintHeatmap()` はゲーム画面の「このゲームのヒートマップ」でも使う（countup.html でも読み込む） |
| data/ | data_01.js | データ画面の Count-Up / 01 / Cricket の切り替えと、01 の記録の表示（設定ごとの上がり率・上がるまでのダーツ数・推移・一覧） |
| data/ | data_cricket.js | データ画面のクリケットの記録の表示（MPR・クローズ率・推移・数字ごとのマーク・一覧） |
| data/ | data_hub.js | データ画面のトップ（開いたときに最初に出す。成績のまとめ・見る画面（Games / Analysis）の選択・練習した日のカレンダー・最近のゲーム。各画面から「‹ Top」・端末の戻るで戻る） |
| data/ | rating.js | PPD から DARTSLIVE / PHOENIX のレーティング目安を算出 |
| ui/ | chart.js | ゲーム画面のグラフ描画のみ（計算は stats.js 側） |
| ui/ | settings.js | 設定画面のロジック |
| ui/ | news.js | お知らせ一覧の表示 |

設計原則：ゲームロジックと UI 操作を分離する / 永続化は他に依存しない / 統計計算は再利用可能に / 1 モジュール 1 責務。

### CSS（`css/`）

- `base.css`（全体の基礎）、`theme.css`（色などのデザイン。CSS 変数 `--accent` など）
- `layout/lay_*.css`：ゲーム画面の各エリア（core / header / round / input / stats）、クリケットだけで使うもの（cricket。`.cricket-only` / `.no-cricket`）、サイドメニュー（menu）、データ画面（data）
- `responsive/phone.css` / `tablet.css` / `desktop.css`：端末別レイアウト
- `menu.css`（メインメニュー）、`news.css`（お知らせ）

## データ保存

| キー | 保存先 | 内容 |
| --- | --- | --- |
| `dartsPracticeDB` / store `app` / key `sessions` | IndexedDB | 終了したゲームの履歴。使えない環境では LocalStorage `dartsSessionsV2` にフォールバック（旧形式 `dartsSessions` から移行） |
| `dartsPractice` / `dartsPractice01` / `dartsPracticeCricket` | LocalStorage | 進行中ゲームの状態（カウントアップ / 01 / クリケット。`saveGame()` / `loadGame()`。キーは `SAVE_KEY`） |
| `dartsZeroOne` | LocalStorage | 01 の設定（点数・上がり方・ラウンドの上限） |
| `dartsCricket` | LocalStorage | クリケットの設定（ラウンドの上限） |
| `dartsSettings` | LocalStorage | 設定 |
| `dartsDayNotesV2` | LocalStorage | 日別メモ（コメント・タグ・画像） |
| `dartsDataGame` | LocalStorage | データ画面で最後に見ていたゲーム（`"countup"` / `"01"` / `"cricket"`） |

- セッションは保存時に短縮キーへシリアライズされる（`serializeSessionForStorage()`：`d` date, `s` score, `p` ppd, `r` roundScores, `a` awards 配列, `dt` 1 投ごとの記録（刺さった場所・ボード入力の位置）, `bm` ブルモード（セパレートのときだけ 1）など）。アプリ内では `normalizeSessionForApp()` の形で扱う
- フィールドを追加するときは serialize / deserialize / normalize の 3 箇所を揃え、**既存ユーザーの保存データを壊さない**（欠損時のデフォルト値を用意する）
- `gameType` は `"countup"` / `"01"` / `"cricket"`。01 の結果は `zeroOne`（保存時 `z`）、クリケットは `cricket`（保存時 `c`。履歴の `roundAvg` は MPR、`roundScores` はマーク数）。データ画面のカウントアップの表示は `readDataSessions()`（カウントアップだけ）、01 は `data_01.js`、クリケットは `data_cricket.js` が別の画面で出す
- 保存するデータを増やしたら、バックアップ（`backup.js` の書き出し・読み込み）にも含めるか検討する。ファイル形式を変えるときは `BACKUP_VERSION` を上げ、古い形式も読めるようにする

## Service Worker の注意

- `sw.js` は静的ファイルを **cache-first** で配信する（HTML のみ network-first。HTML は `cache: "no-cache"`、先読みは `cache: "reload"` で取り、ブラウザに残った古いファイルを使わない）
- JS / CSS を変更したら `sw.js` の `APP_CACHE` / `RUNTIME_CACHE` のバージョン（`darts-app-vN` / `darts-runtime-vN`）を上げる。上げないと既存ユーザーに古いファイルが残る
- 新しいファイルを追加したら `PRECACHE_URLS` にも追加する

## 今後の予定

- ゲーム追加：Half-it、Shoot-out、プロテストモード（内容は未定）
- 機能追加：高度な分析機能、将来的にはユーザーアカウント・オンライン対戦・AI 対戦
- ダーツボード形式の入力：入力パネルをボード（SVG）にし、設定画面でボタン形式と切り替え（実装済み。`board_input.js`）。最終目標は刺さった位置（座標）を保存して分析すること。詳細は `docs/design.md` の「11. 今後の拡張予定」
- カメラからの自動入力（入力の最終形）：カメラ映像を表示し 20・6・3・11 の 4 点でキャリブレーション。映像を見張って撮影ボタンなしで 3 投を自動判定し、だめなときは撮影ボタン、外れたときはボード形式の入力で修正。位置はセグメント内 6 分割程度の粗さで十分、保存は座標で行い区画分けは分析時に決める。詳細は `docs/design.md` の「11. 今後の拡張予定」
