export const SKY_STYLE = {
  background: '#04060c', grid: '#182238', constellation: '#3b4d75',
  raStepDegrees: 15, decStepDegrees: 15,
};

export function starAppearance(magnitude) {
  // The reference chart specifies marker area in points²; WebGL takes a pixel diameter.
  const area = .55 * Math.max(0, 6.9 - magnitude) ** 2.3;
  const diameter = Math.max(.65, Math.sqrt(area) * 96 / 72);
  return {
    diameter,
    opacity: Math.max(.25, Math.min(1, .25 + .115 * (6.6 - magnitude))),
    ringDiameter: magnitude < 1.6 ? Math.max(14, diameter + 7) : 0,
  };
}
