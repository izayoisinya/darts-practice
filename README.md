# Darts Practice

ダーツアプリ — ダーツのゲームのスコア記録データを表示するアプリです。

自宅でのダーツ練習のスコアを記録し、履歴・スタッツ・グラフで振り返ることができます。
対戦中心のアプリではなく、練習の分析に特化した Web アプリ（PWA 対応）です。

## 主な機能

### スコア記録（COUNT-UP）
- 8 ラウンド × 3 投の COUNT-UP を 1 投ごとに入力
- Bull / 1〜20 / D（ダブル）/ T（トリプル）の入力パネル
- ラウンドごとのスコア表示と、ゲーム終了時の自動保存

### スコア記録データの表示（Data 画面）
- **History**：ゲーム単位の履歴一覧（ページ送り対応）
- **集計ビュー**：Game / Day / Week / Month / Year ごとにまとめて表示
- **Stats**：ゲーム数・ベストスコア・平均 PPD・ブル数などのスタッツ（日別詳細ではブル率も表示）
- **Awards**：ハットトリック、LOW TON、HIGH TON、TON80、3 IN THE BLACK、3 IN THE BED、WHITE HORSE の回数
- **グラフ**：直近 30 ゲームのスコア推移、指定期間（A/B 2 期間）の比較グラフ
- **カレンダー**：練習した日をカレンダーで確認
- **日別メモ**：コメント・タグ・セッティング画像を記録し、タグで絞り込み・比較
- **レーティング目安**：スコアに対応するレーティングの参考表示

### その他
- お知らせ（Info）画面、設定（Settings）画面
- スマホ / タブレット / デスクトップのレスポンシブ対応
- PWA としてホーム画面に追加してオフライン利用可能

## 画面構成

| ファイル | 画面 |
| --- | --- |
| `index.html` | メインメニュー |
| `countup.html` | COUNT-UP（スコア入力） |
| `data.html` | スコア記録データの表示（Statistics） |
| `settings.html` | 設定・ストレージ状況 |
| `news.html` | お知らせ |

## データ保存

データはすべてブラウザ内に保存され、外部サーバーには送信されません。

- ゲーム履歴：IndexedDB（`dartsPracticeDB`）。利用できない環境では LocalStorage にフォールバック
- 日別メモ・設定など：LocalStorage

## 使い方

ビルド不要の静的サイトです。任意の静的サーバーで配信してブラウザで開いてください。

```sh
python3 -m http.server 8000
# http://localhost:8000/ を開く
```

Service Worker（`sw.js`）を利用するため、`file://` ではなく HTTP(S) で開くことを推奨します。

## 技術構成

- HTML / CSS / JavaScript（フレームワーク・ビルドツールなし）
- グラフは Canvas で描画
- PWA（`manifest.json`, `sw.js`）

## 今後の予定

- 01 / Cricket / Half-it / Shoot-out などのゲームモード追加
- ブル練習分析・スタッツ分析などの練習分析機能

機能の仕様は `Darts Practice App 仕様書 v01.text`、内部設計（ファイルの責務・データ形式など）は [`docs/design.md`](docs/design.md) を参照してください。
