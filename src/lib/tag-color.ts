const palette = {
  blue: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
  green: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
  purple: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30',
  red: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
  orange: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30',
  pink: 'bg-pink-500/20 text-pink-700 dark:text-pink-300 border-pink-500/30',
  cyan: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
};
const colors = Object.values(palette);
// Let neutral Jira categories fall back to a visible color based on the status name.
const namedColors = new Map(Object.entries({
  ...palette,
  'warm-red': palette.red,
  'brown': 'bg-amber-800/20 text-amber-900 dark:text-amber-300 border-amber-800/30',
}));

export function getTagColor(tagName: string, colorName?: string): string {
  const configured = colorName && namedColors.get(colorName);
  if (configured) return configured;
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
