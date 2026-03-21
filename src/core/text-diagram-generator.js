/**
 * Text-Based Diagram Generator
 * ASCII art fallback diagrams for environments without Mermaid support.
 */

export function textSystemContext(components) {
  const maxLen = Math.max(...components.map(c => c.length), 10);
  const boxWidth = maxLen + 4;

  let diagram = '┌' + '─'.repeat(boxWidth + 16) + '┐\n';
  diagram += '│  ServiceNow Platform' + ' '.repeat(boxWidth - 5) + '│\n';
  diagram += '│' + ' '.repeat(boxWidth + 16) + '│\n';

  components.forEach(c => {
    const padded = c.padEnd(maxLen);
    diagram += `│    ┌${'─'.repeat(maxLen + 2)}┐    │\n`;
    diagram += `│    │ ${padded} │    │\n`;
    diagram += `│    └${'─'.repeat(maxLen + 2)}┘    │\n`;
  });

  diagram += '│' + ' '.repeat(boxWidth + 16) + '│\n';
  diagram += '└' + '─'.repeat(boxWidth + 16) + '┘\n';
  diagram += '         ▲\n';
  diagram += '         │\n';
  diagram += '    ┌────┴────┐\n';
  diagram += '    │  User   │\n';
  diagram += '    └─────────┘\n';

  return diagram;
}

export function textComponentTree(layers) {
  let diagram = 'Component Architecture\n';
  diagram += '══════════════════════\n\n';

  const layerNames = Object.keys(layers).filter(k => layers[k].length > 0);

  layerNames.forEach((layerName, idx) => {
    const items = layers[layerName];
    const isLast = idx === layerNames.length - 1;
    const prefix = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';

    diagram += `${prefix}${layerName}\n`;
    items.forEach((item, itemIdx) => {
      const itemPrefix = itemIdx === items.length - 1 ? '└── ' : '├── ';
      diagram += `${childPrefix}${itemPrefix}${item}\n`;
    });
  });

  return diagram;
}

export function textSequenceFlow(steps) {
  let diagram = 'Sequence Flow\n';
  diagram += '═════════════\n\n';

  steps.forEach((step, idx) => {
    const num = String(idx + 1).padStart(2);
    diagram += `  ${num}. ${step}\n`;
    if (idx < steps.length - 1) {
      diagram += '      │\n';
      diagram += '      ▼\n';
    }
  });

  return diagram;
}
