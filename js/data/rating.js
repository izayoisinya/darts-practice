// ===============================
// ===== レーティング計算 ========
// ===============================

const DARTSLIVE_RATING_TABLE = [
  [34.0, 18],
  [31.0, 17],
  [28.0, 16],
  [25.0, 15],
  [22.5, 14],
  [20.5, 13],
  [18.5, 12],
  [17.0, 11],
  [15.5, 10],
  [14.0,  9],
  [12.5,  8],
  [11.0,  7],
  [ 9.5,  6],
  [ 8.0,  5],
  [ 6.5,  4],
  [ 5.0,  3],
  [ 3.0,  2],
  [ 0.0,  1],
]

const PHOENIX_RATING_TABLE = [
  [45.0, 30],
  [43.0, 29],
  [41.0, 28],
  [39.0, 27],
  [37.0, 26],
  [35.0, 25],
  [33.0, 24],
  [31.0, 23],
  [29.0, 22],
  [27.5, 21],
  [26.0, 20],
  [24.5, 19],
  [23.0, 18],
  [21.5, 17],
  [20.0, 16],
  [18.5, 15],
  [17.0, 14],
  [15.5, 13],
  [14.0, 12],
  [12.5, 11],
  [11.0, 10],
  [ 9.5,  9],
  [ 8.0,  8],
  [ 6.8,  7],
  [ 5.6,  6],
  [ 4.6,  5],
  [ 3.6,  4],
  [ 2.6,  3],
  [ 1.6,  2],
  [ 0.0,  1],
]

function getDartsLiveRatingReference() {
  return DARTSLIVE_RATING_TABLE.map(([ppd, rating]) => ({ ppd, rating }))
}

function getPhoenixRatingReference() {
  return PHOENIX_RATING_TABLE.map(([ppd, rating]) => ({ ppd, rating }))
}

/**
 * PPD（Points Per Dart）からダーツライブ風 RT を計算する。
 * 公式アルゴリズムは非公開のため、広く知られている目安値を元にした
 * 非公式換算テーブルを使用している。
 *
 * カウントアップのみの場合は01/クリケットの成績がないため、
 * PPD から 01 相当の RT のみを推定する。
 * RT = 1〜18
 */
function calcDartsLiveRT(ppd) {
  for (const [threshold, rt] of DARTSLIVE_RATING_TABLE) {
    if (ppd >= threshold) return rt
  }
  return 1
}

/**
 * PPD からフェニックス風 RATING を計算する。
 * フェニックスも公式非公開のため非公式換算。
 * フェニックスは 01 と Cricket の複合だが、
 * ここでは PPD のみで 01 相当を推定する。
 * RATING = 1〜30
 */
function calcPhoenixRating(ppd) {
  // フェニックスは全体的にダーツライブより若干高め設定という
  // 一般的な認識に基づき、スケールを少し変えている
  for (const [threshold, rt] of PHOENIX_RATING_TABLE) {
    if (ppd >= threshold) return rt
  }
  return 1
}

/**
 * セッション配列から加重平均 PPD を計算してレーティングを返す。
 * 直近のゲームほど重みを大きくする（線形加重）。
 * @param {Array} sessions - セッション配列（古い順）
 * @param {number} [window=20] - 使用する直近ゲーム数
 * @returns {{ ppd: number, rt: number, phx: number }}
 */
function calculateRatings(sessions, window = 20) {
  if (!sessions || sessions.length === 0) {
    return { ppd: 0, rt: 1, phx: 1 }
  }

  // 直近 window ゲームを取得（新しい順に並んでいると仮定して末尾から）
  const recent = sessions.slice(-window)

  // 線形加重: 最古=1, 最新=n
  let weightSum = 0
  let weightedPPD = 0
  recent.forEach((s, i) => {
    const w = i + 1
    weightSum += w
    weightedPPD += (s.ppd || 0) * w
  })

  const ppd = weightSum > 0 ? weightedPPD / weightSum : 0

  return {
    ppd: Math.round(ppd * 100) / 100,
    rt: calcDartsLiveRT(ppd),
    phx: calcPhoenixRating(ppd),
  }
}