export const LEVEL_TITLES = [
  "Larbin",
  "Apprenti",
  "Stagiaire",
  "Padawan ménager",
  "Corvéable",
  "Bras droit",
  "Pro du balai",
  "Expert",
  "Maître",
  "Grand Maître",
  "Légende du foyer",
];

export function xpForLevel(level) {
  return Math.floor(50 * level * level);
}

export function getLevelFromXP(totalXp) {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXp) level++;
  return level;
}

export function getLevelTitle(level) {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
}

export function getXPProgress(totalXp, level) {
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const progress = (totalXp - currentLevelXp) / (nextLevelXp - currentLevelXp);
  return Math.max(0, Math.min(progress, 1));
}

export function getXPToNextLevel(totalXp, level) {
  return xpForLevel(level + 1) - totalXp;
}

export function getUrgency(lastCompletedAt, frequencyHours) {
  if (!lastCompletedAt) return 1.5;
  const hoursSince =
    (Date.now() - new Date(lastCompletedAt).getTime()) / (1000 * 60 * 60);
  return Math.min(hoursSince / frequencyHours, 1.5);
}

export function getUrgencyColor(urgency) {
  if (urgency < 0.5) return "#00ff88";
  if (urgency < 0.75) return "#eab308";
  if (urgency < 1.0) return "#f97316";
  return "#ef4444";
}

export function getUrgencyLabel(urgency) {
  if (urgency < 0.5) return "OK";
  if (urgency < 0.75) return "BIENTÔT";
  if (urgency < 1.0) return "URGENT";
  return "EN RETARD";
}

export function formatTimeAgo(dateString) {
  if (!dateString) return "Jamais fait";
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  const diffD = Math.floor(diffH / 24);
  if (diffH < 1) return "À l'instant";
  if (diffH < 24) return `Il y a ${diffH}h`;
  if (diffD === 1) return "Hier";
  return `Il y a ${diffD}j`;
}
