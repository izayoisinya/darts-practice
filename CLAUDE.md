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
- 端末判定は `core.js` の `detectDevice()` が `body` に `phone` / `tablet` / `desktop` と `portrait` / `landscape` クラスを付与し、`css/responsive/*.css` がそれを見て切り替える（メディアクエリより body クラスが基本）

## ディレクトリと責務

```
index.html      メインメニュー（ゲーム選択 / Data / Settings / Info）
countup.html    COUNT-UP ゲーム画面（Rounds / Input / Stats の 3 エリア）
data.html       スコア記録データの表示（Statistics）
settings.html   設定（ブルモード: fat / double、画面向き、ストレージ状況）
news.html       お知らせ
sw.js           Service Worker（プリキャッシュ）
manifest.json   PWA マニフェスト
```

### JavaScript（`js/`）

| フォルダ | ファイル | 責務 |
| --- | --- | --- |
| core/ | state.js | グローバル変数・定数のみ（`TOTAL_ROUNDS`, `game`, `sessions`, `bullMode` など）。**関数は書かない** |
| core/ | core.js | 全画面共通：`detectDevice()`, `refreshLayout()`, `setupLinks()` |
| core/ | storage.js | 永続化のみ。**ビジネスロジックを入れない・他モジュールに依存しない** |
| core/ | backup.js | バックアップの書き出し・読み込み（ゲーム記録と日別メモの JSON 化・取り込み）。DOM 操作なし（UI は settings.js） |
| init/ | main.js | 初期化（`initApp()`）、イベント登録（`registerEvents()`）、SW 登録、メニュー画面のサマリー |
| game/ | game_core.js | ゲーム共通ロジック（次ゲーム、Undo、終了判定、リセット）。UI 生成は含まない |
| game/ | game_countup.js | COUNT-UP 固有ロジック（`initGame()`, `addDart()`）。UI 生成は含まない |
| game/ | cu_ui.js | COUNT-UP の UI 生成・DOM 操作 |
| game/ | stats.js | スタッツ・アワード計算。**UI 表示・DOM 操作は含まない**（再利用できる形にする） |
| data/ | data_loader.js | セッション読込・グループ化・集計・ページネーション、`initDataPage()` |
| data/ | data.js | データ画面の統括（ビュー切替、Stats/Awards 表示、グラフ、期間比較） |
| data/ | data_grouped.js | Day/Week/Month/Year のグループビュー、日別メモ・タグ |
| data/ | data_detail.js | グループ内のゲーム一覧（詳細ビュー）、カレンダー、比較 |
| data/ | rating.js | PPD から DARTSLIVE / PHOENIX のレーティング目安を算出 |
| ui/ | chart.js | ゲーム画面のグラフ描画のみ（計算は stats.js 側） |
| ui/ | settings.js | 設定画面のロジック |
| ui/ | news.js | お知らせ一覧の表示 |

設計原則：ゲームロジックと UI 操作を分離する / 永続化は他に依存しない / 統計計算は再利用可能に / 1 モジュール 1 責務。

### CSS（`css/`）

- `base.css`（全体の基礎）、`theme.css`（色などのデザイン。CSS 変数 `--accent` など）
- `layout/lay_*.css`：ゲーム画面の各エリア（core / header / round / input / stats）、サイドメニュー（menu）、データ画面（data）
- `responsive/phone.css` / `tablet.css` / `desktop.css`：端末別レイアウト
- `menu.css`（メインメニュー）、`news.css`（お知らせ）

## データ保存

| キー | 保存先 | 内容 |
| --- | --- | --- |
| `dartsPracticeDB` / store `app` / key `sessions` | IndexedDB | 終了したゲームの履歴。使えない環境では LocalStorage `dartsSessionsV2` にフォールバック（旧形式 `dartsSessions` から移行） |
| `dartsPractice` | LocalStorage | 進行中ゲームの状態（`saveGame()` / `loadGame()`） |
| `dartsSettings` | LocalStorage | 設定 |
| `dartsDayNotesV2` | LocalStorage | 日別メモ（コメント・タグ・画像） |

- セッションは保存時に短縮キーへシリアライズされる（`serializeSessionForStorage()`：`d` date, `s` score, `p` ppd, `r` roundScores, `a` awards 配列 など）。アプリ内では `normalizeSessionForApp()` の形で扱う
- フィールドを追加するときは serialize / deserialize / normalize の 3 箇所を揃え、**既存ユーザーの保存データを壊さない**（欠損時のデフォルト値を用意する）
- `gameType` は現在 `"countup"` のみ。新しいゲームはこれで区別する
- 保存するデータを増やしたら、バックアップ（`backup.js` の書き出し・読み込み）にも含めるか検討する。ファイル形式を変えるときは `BACKUP_VERSION` を上げ、古い形式も読めるようにする

## Service Worker の注意

- `sw.js` は静的ファイルを **cache-first** で配信する（HTML のみ network-first）
- JS / CSS を変更したら `sw.js` の `APP_CACHE` / `RUNTIME_CACHE` のバージョン（`darts-app-vN` / `darts-runtime-vN`）を上げる。上げないと既存ユーザーに古いファイルが残る
- 新しいファイルを追加したら `PRECACHE_URLS` にも追加する

## 今後の予定

- ゲーム追加：01、Cricket、Half-it、Shoot-out（メニュー・サイドメニューに `Coming Soon` のボタンあり）
- 機能追加：高度な分析機能、将来的にはユーザーアカウント・オンライン対戦・AI 対戦
