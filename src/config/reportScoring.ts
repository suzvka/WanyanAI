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

export const reportSubscoreCount = 6;

export function calculateMaximumReportScore(
	weightMultiplier = reportWeightMultiplier,
	subscoreCount = reportSubscoreCount,
) {
	return reportRatingBaseScores.S * weightMultiplier * subscoreCount;
}
