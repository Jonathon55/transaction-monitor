import { interpolateBlues } from 'd3-scale-chromatic';
import PersonIcon from '@mui/icons-material/Person';

const PERSON_ICON = {
  type: 'textIcon',
  family: 'Material Icons',
  text: 'person',
  color: '#fff',
  size: 22,
};

export function concatSet(a, b) {
  const newSet = new Set();
  a.forEach((item) => newSet.add(item));
  b.forEach((item) => newSet.add(item));
  return newSet;
}

const color = (x) => interpolateBlues(Math.max(Math.min(9, x), 4) / 10);
const getRandomPastelColor = () => {
  const hue = Math.floor(Math.random() * 360); // Random hue (0 to 360)
  const saturation = 80 + Math.random() * 60; // Slightly muted pastel colors
  const lightness = 25 + Math.random() * 10; // Light tones

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

// Store node colors persistently
const nodeColorMap = new Map();

// Stable fallback colors for nodes that don't have risk/community data.
// We cache by node.id so the color doesn't flicker across renders.
const nodeColorCache = new Map();

// Read the user's selected color mode from localStorage.
// The toggle in App.tsx writes this value ('risk' | 'community').
function getColorMode() {
  return localStorage.getItem('colorMode') || 'risk';
}

// Convert a risk score (0..100) to an HSL color on a green->red scale.
// 0 => green (120deg), 100 => red (0deg).
function colorByRiskScore(riskScore) {
  const score = Math.max(0, Math.min(100, Number(riskScore) || 0));
  const hue = 120 - score * 1.2; // linear mapping from 120..0
  return `hsl(${hue}, 70%, 45%)`; // good contrast on dark theme
}

// Deterministic (simple) string hash to a hue 0..359.
// Used to color communities consistently by id.
function hashStringToHue(input) {
  let hash = 0;
  for (let index = 0; index < input.length; index++) {
    hash = input.charCodeAt(index) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return hue;
}

// Map community id -> stable HSL color using the hash above.
function colorByCommunityId(communityId) {
  const hue = hashStringToHue(String(communityId));
  return `hsl(${hue}, 55%, 45%)`;
}

/**
 * styleNode is invoked by Trellis to decorate each node for rendering.
 * We choose the fill color based on the user's mode:
 *   - 'risk': use riskScore (0..100) to pick green->red
 *   - 'community': use communityId to pick a stable color
 *   - fallback: a cached pastel color per node id
 *
 * We also define label styling and the icon. Background is omitted (transparent).
 */
export const styleNode = (node, isHovering, isSelected, colorModeOverride) => {
  const mode = colorModeOverride ?? getColorMode();

  let nodeColor;
  if (mode === 'risk' && node.riskScore != null) {
    nodeColor = colorByRiskScore(node.riskScore);
  } else if (mode === 'community' && node.communityId != null) {
    nodeColor = colorByCommunityId(node.communityId);
  } else {
    if (!nodeColorCache.has(node.id))
      nodeColorCache.set(node.id, getRandomPastelColor());
    nodeColor = nodeColorCache.get(node.id);
  }

  return {
    ...node,
    style: {
      color: nodeColor,
      labelSize: 10,
      labelWordWrap: 260,
      icon: PERSON_ICON,
      label: { color: '#fff', fontSize: 20 },
    },
  };
};
