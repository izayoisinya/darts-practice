// ===============================
// ===== レーティング計算 ========
// ===============================

/**
 * PPD（Points Per Dart）からダーツライブ風 RT を計算する。
 * 公式アルゴリズムは非公開のため、広く知られている目安値を元にした
 * 非公式換算テーブルを使用している。
 *
 * カウントアップのみの場合は01/クリケットの成績がないため、
 * PPD から 01 相当の RT のみを推定する。
 * RT = 1〜20
 */
function calcDartsLiveRT(ppd) {
  // PPD → RT 換算テーブル（境界値: [ppd以上ならこのRT] の降順）
  const table = [
    [43.0, 20],
    [38.0, 19],
    [34.0, 18],
    [30.0, 17],
    [27.0, 16],
    [24.0, 15],
    [21.5, 14],
    [19.5, 13],
    [17.5, 12],
    [16.0, 11],
    [14.5, 10],
    [13.0,  9],
    [11.5,  8],
    [10.0,  7],
    [ 8.5,  6],
    [ 7.0,  5],
    [ 5.5,  4],
    [ 4.0,  3],
    [ 2.5,  2],
    [  0,   1],
  ]
  for (const [threshold, rt] of table) {
    if (ppd >= threshold) return rt
  }
  return 1
}

/**
 * PPD からフェニックス風 RATING を計算する。
 * フェニックスも公式非公開のため非公式換算。
 * フェニックスは 01 と Cricket の複合だが、
 * ここでは PPD のみで 01 相当を推定する。
 * RATING = 1〜20
 */
function calcPhoenixRating(ppd) {
  // フェニックスは全体的にダーツライブより若干高め設定という
  // 一般的な認識に基づき、スケールを少し変えている
  const table = [
    [44.0, 20],
    [39.0, 19],
    [35.0, 18],
    [31.0, 17],
    [28.0, 16],
    [25.0, 15],
    [22.5, 14],
    [20.0, 13],
    [18.0, 12],
    [16.5, 11],
    [15.0, 10],
    [13.5,  9],
    [12.0,  8],
    [10.5,  7],
    [ 9.0,  6],
    [ 7.5,  5],
    [ 6.0,  4],
    [ 4.5,  3],
    [ 3.0,  2],
    [  0,   1],
  ]
  for (const [threshold, rt] of table) {
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