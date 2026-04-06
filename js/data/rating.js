// ===============================
// ===== レーティング計算 ========
// ===============================

const DARTSLIVE_RATING_TABLE = [
  // DARTSLIVE公開表（01: PPR）を PPD換算（PPR / 3）
  [43.33, 18],
  [41.00, 17],
  [38.67, 16],
  [36.33, 15],
  [34.00, 14],
  [31.67, 13],
  [30.00, 12],
  [28.33, 11],
  [26.67, 10],
  [25.00,  9],
  [23.33,  8],
  [21.67,  7],
  [20.00,  6],
  [18.33,  5],
  [16.67,  4],
  [15.00,  3],
  [13.33,  2],
  [ 0.0,  1],
]

const PHOENIX_RATING_TABLE = [
  // フェニックス30分割換算表（01GAME AVERAGE/PPD）準拠
  [48.00, 30],
  [46.60, 29],
  [45.20, 28],
  [43.80, 27],
  [42.40, 26],
  [41.00, 25],
  [39.60, 24],
  [38.20, 23],
  [36.80, 22],
  [35.40, 21],
  [34.05, 20],
  [32.70, 19],
  [31.35, 18],
  [30.00, 17],
  [28.65, 16],
  [27.30, 15],
  [25.95, 14],
  [24.65, 13],
  [23.35, 12],
  [22.05, 11],
  [20.75, 10],
  [19.45,  9],
  [18.15,  8],
  [16.90,  7],
  [15.65,  6],
  [14.40,  5],
  [13.15,  4],
  [11.90,  3],
  [10.65,  2],
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