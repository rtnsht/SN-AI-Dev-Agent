#!/usr/bin/env node
/**
 * Design Enhancement Script
 * Reads an existing 2-design.md, generates diagrams from its content,
 * and inserts them into the Architecture section.
 *
 * Usage:
 *   node scripts/enhance-design.cjs --req REQ-001
 *   node scripts/enhance-design.cjs --file path/to/2-design.md
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let designPath = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--req' && args[i + 1]) {
    designPath = path.join(__dirname, '..', 'specs', args[i + 1], '2-design.md');
    i++;
  } else if (args[i] === '--file' && args[i + 1]) {
    designPath = path.resolve(args[i + 1]);
    i++;
  }
}

if (!designPath) {
  console.error('Usage: node scripts/enhance-design.cjs --req REQ-XXX');
  console.error('       node scripts/enhance-design.cjs --file path/to/2-design.md');
  process.exit(1);
}

if (!fs.existsSync(designPath)) {
  console.error(`Design file not found: ${designPath}`);
  process.exit(1);
}

console.log(`Reading design document: ${designPath}`);
const content = fs.readFileSync(designPath, 'utf-8');

// Simple inline parser (avoids ESM import issues with the src/core modules)
function parseArtifactsTable(content) {
  const artifacts = [];
  const lines = content.split('\n');
  let inSection = false;
  let headerFound = false;
  let headers = [];

  for (const line of lines) {
    if (/^#{1,4}\s/.test(line)) {
      if (line.includes('4.2') || line.includes('Summary Table')) {
        inSection = true;
        continue;
      }
      if (inSection && (line.includes('4.3') || line.includes('Deployment'))) {
        break;
      }
    }

    if (!inSection) continue;

    if (line.trim().startsWith('|') && !headerFound) {
      headers = line.split('|').map(h => h.trim()).filter(h => h && !h.match(/^[-:]+$/));
      headerFound = true;
      continue;
    }

    if (headerFound && line.trim().match(/^\|[\s-:|]+\|$/)) continue;

    if (headerFound && line.trim().startsWith('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length >= 2 && cells[0]) {
        const typeMap = {
          'Script Include': 'script_include',
          'Business Rule': 'business_rule',
          'Client Script': 'client_script',
          'UI Policy': 'ui_policy',
          'Flow': 'flow',
          'Custom Field': 'field',
          'Custom Table': 'table',
          'Notification': 'notification',
          'Event': 'event'
        };
        artifacts.push({
          name: cells[0],
          type: typeMap[cells[1]] || cells[1].toLowerCase().replace(/\s+/g, '_'),
          table: cells[2] || '',
          description: cells[cells.length - 1] || ''
        });
      }
    }
  }
  return artifacts;
}

function generateMermaidSystemContext(artifacts) {
  let d = 'flowchart TD\n';
  d += '    subgraph SN ["ServiceNow Platform"]\n';
  artifacts.forEach(a => {
    const id = a.name.replace(/[^a-zA-Z0-9]/g, '_');
    d += `        ${id}["${a.name}"]\n`;
  });
  d += '    end\n';
  d += '    User(("User")) --> SN\n';
  return d;
}

function generateMermaidComponent(artifacts) {
  const layers = {
    'Business Logic': artifacts.filter(a => ['business_rule', 'script_include', 'flow'].includes(a.type)),
    'Presentation': artifacts.filter(a => ['client_script', 'ui_policy'].includes(a.type)),
    'Data': artifacts.filter(a => ['table', 'field'].includes(a.type))
  };

  let d = 'flowchart LR\n';
  Object.entries(layers).forEach(([name, items]) => {
    if (items.length === 0) return;
    const safeId = name.replace(/\s+/g, '');
    d += `    subgraph ${safeId} ["${name}"]\n`;
    items.forEach(item => {
      const id = item.name.replace(/[^a-zA-Z0-9]/g, '_');
      d += `        ${id}["${item.name}"]\n`;
    });
    d += '    end\n';
  });
  return d;
}

function generateMermaidSequence(artifacts) {
  let d = 'sequenceDiagram\n';
  d += '    participant User\n';
  d += '    participant SN as ServiceNow\n\n';

  const cs = artifacts.filter(a => a.type === 'client_script');
  const br = artifacts.filter(a => a.type === 'business_rule');
  const si = artifacts.filter(a => a.type === 'script_include');

  if (cs.length > 0) {
    d += `    User->>+SN: Interact with form\n`;
    d += `    SN->>SN: ${cs[0].name}\n`;
  }
  if (br.length > 0) {
    d += `    User->>+SN: Save record\n`;
    d += `    SN->>SN: ${br[0].name}\n`;
  }
  if (si.length > 0) {
    d += `    SN->>SN: Call ${si[0].name}\n`;
  }
  d += '    SN-->>-User: Response\n';

  return d;
}

// Parse artifacts
const artifacts = parseArtifactsTable(content);
console.log(`Found ${artifacts.length} artifacts in design document`);

if (artifacts.length === 0) {
  console.log('No artifacts found in Section 4.2. Diagrams will use placeholder content.');
  artifacts.push({ name: 'Placeholder', type: 'script_include', table: '', description: '' });
}

// Generate diagrams
const systemContext = generateMermaidSystemContext(artifacts);
const component = generateMermaidComponent(artifacts);
const sequence = generateMermaidSequence(artifacts);

// Replace AUTO_DIAGRAM markers
let updated = content;

const markers = [
  { marker: '<!-- AUTO_DIAGRAM:system_context -->', diagram: systemContext },
  { marker: '<!-- AUTO_DIAGRAM:component -->', diagram: component },
  { marker: '<!-- AUTO_DIAGRAM:sequence -->', diagram: sequence }
];

let replacements = 0;
markers.forEach(({ marker, diagram }) => {
  if (updated.includes(marker)) {
    // Replace the marker AND the next mermaid code fence block after it
    const markerIdx = updated.indexOf(marker);
    const afterMarker = updated.substring(markerIdx + marker.length);
    const mermaidStart = afterMarker.indexOf('```mermaid');

    if (mermaidStart !== -1) {
      const mermaidEnd = afterMarker.indexOf('```', mermaidStart + 10);
      if (mermaidEnd !== -1) {
        const before = updated.substring(0, markerIdx);
        const after = updated.substring(markerIdx + marker.length + mermaidEnd + 3);
        updated = before + marker + '\n\n```mermaid\n' + diagram + '```' + after;
        replacements++;
      }
    } else {
      // No existing mermaid block after marker, just insert one
      updated = updated.replace(marker, marker + '\n\n```mermaid\n' + diagram + '```\n');
      replacements++;
    }
  }
});

if (replacements > 0) {
  fs.writeFileSync(designPath, updated, 'utf-8');
  console.log(`Updated ${replacements} diagram(s) in ${designPath}`);
} else {
  console.log('No AUTO_DIAGRAM markers found. Add markers to the design template first.');
}

console.log('Done.');
