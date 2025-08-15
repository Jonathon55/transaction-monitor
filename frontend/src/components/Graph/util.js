import { interpolateBlues } from "d3-scale-chromatic";
import PersonIcon from '@mui/icons-material/Person';

const PERSON_ICON = {
  type: "textIcon",
  family: "Material Icons",
  text: "person",
  color: "#fff",
  size: 22
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
  const saturation = 80 + Math.random() * 60;  // Slightly muted pastel colors
  const lightness = 25 + Math.random() * 10;   // Light tones

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

// Store node colors persistently
const nodeColorMap = new Map();

export const styleNode = (node, hover, selected) => {
  // Check if this node already has a color assigned
  if (!nodeColorMap.has(node.id)) {
    // If not, generate and store a color for this node
    nodeColorMap.set(node.id, getRandomPastelColor());
  }
  
  // Use the stored color
  let style = {
    color: nodeColorMap.get(node.id),
    labelSize: 10,
    labelWordWrap: 260,
    icon: PERSON_ICON,
    label: {
      color: '#fff',
      fontSize: 20,
      background: 'undefined'
    },
  };

  return { ...node, style };
};
