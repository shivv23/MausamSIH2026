// Design tokens from the definitive blueprint PART EIGHT §8.3.
export const colors = {
  primary: '#1565C0',
  primaryLight: '#64B5F6',
  surface: '#F8FAFE',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#6B7280',
  sunny: '#FFB300',
  cloudy: '#78909C',
  rainy: '#42A5F5',
  stormy: '#5C6BC0',
  scoreExcellent: '#4CAF50',
  scoreGood: '#8BC34A',
  scoreFair: '#FFC107',
  scorePoor: '#FF9800',
  scoreAvoid: '#F44336',
  warningOrange: '#FF9800',
  warningRed: '#F44336',
  warningYellow: '#FFC107',
};

export function scoreColor(score: number): string {
  if (score >= 80) return colors.scoreExcellent;
  if (score >= 60) return colors.scoreGood;
  if (score >= 40) return colors.scoreFair;
  if (score >= 20) return colors.scorePoor;
  return colors.scoreAvoid;
}

export function phaseColor(phase?: string): string {
  switch (phase) {
    case 'official':
      return colors.warningRed;
    case 'derived':
      return colors.primary;
    default:
      return colors.textMuted;
  }
}