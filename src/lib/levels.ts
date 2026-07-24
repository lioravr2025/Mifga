const LEVEL_TITLES = ["טירון", "סייר", "שומר כביש", "צייד מפגעים", "אלוף התנועה", "אגדת מפגע"];
const POINTS_PER_LEVEL = 50;

export function levelForPoints(points: number) {
  const levelIndex = Math.min(Math.floor(points / POINTS_PER_LEVEL), LEVEL_TITLES.length - 1);
  const level = levelIndex + 1;
  const title = LEVEL_TITLES[levelIndex];
  const floor = levelIndex * POINTS_PER_LEVEL;
  const ceil = (levelIndex + 1) * POINTS_PER_LEVEL;
  const isMax = levelIndex === LEVEL_TITLES.length - 1;
  const progress = isMax ? 1 : (points - floor) / (ceil - floor);
  return { level, title, progress, pointsToNext: isMax ? 0 : ceil - points, isMax };
}
