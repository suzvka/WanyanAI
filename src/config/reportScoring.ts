export const reportRatingValues = ['S', 'A', 'B', 'C', 'D'] as const;

export type ReportRating = (typeof reportRatingValues)[number];

export const reportRatingDisplayLabels: Record<ReportRating, string> = {
	S: '夯',
	A: '顶级',
	B: '人上人',
	C: 'NPC',
	D: '拉完了',
};

export const reportRatingBaseScores: Record<ReportRating, number> = {
	S: 5,
	A: 4,
	B: 3,
	C: 2,
	D: 1,
};

export const reportWeightMultiplier = 4;

/** 中性乘子（幂次映射的锚点） */
export const reportNeutralMultiplier = 1;

/** 基准分（中性状态下S级的分数） */
export const reportBaseScore = 20;

/** 最高基础分（用于归一化） */
export const reportMaxBaseScore = 5;
