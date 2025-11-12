export function parseAccountAge(ageText) {
  if (!ageText) return 0;

  const years = ageText.match(/(\d+)\s*year/);
  const months = ageText.match(/(\d+)\s*month/);

  if (years) return parseInt(years[1], 10) * 12;
  if (months) return parseInt(months[1], 10);

  return 0;
}

export function parseNumber(text) {
  if (!text) return 0;
  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export function parseRating(text) {
  if (!text) return 0;
  const match = text.match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : 0;
}

export function parsePercentage(text) {
  if (!text) return 0;
  const match = text.match(/(\d+)%/);
  return match ? parseInt(match[1], 10) : 0;
}

