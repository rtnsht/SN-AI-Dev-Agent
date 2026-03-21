/**
 * Mermaid Diagram Templates
 * Pure functions returning Mermaid syntax strings for common diagram types.
 */

export function systemContextDiagram(components, externalSystems) {
  let diagram = 'flowchart TD\n';
  diagram += '    subgraph SN [ServiceNow Platform]\n';
  components.forEach(c => {
    diagram += `        ${c.id}["${c.label}"]\n`;
  });
  diagram += '    end\n\n';

  const seen = new Set();
  externalSystems.forEach(ext => {
    if (seen.has(ext.id)) return;
    seen.add(ext.id);
    diagram += `    ${ext.id}(("${ext.label}"))\n`;
    const dir = (ext.direction || '').toLowerCase();
    if (dir === 'inbound') {
      diagram += `    ${ext.id} --> SN\n`;
    } else if (dir === 'outbound') {
      diagram += `    SN --> ${ext.id}\n`;
    } else {
      diagram += `    SN <--> ${ext.id}\n`;
    }
  });

  if (externalSystems.length === 0) {
    diagram += '    User(("User")) --> SN\n';
  }

  return diagram;
}

export function componentDiagram(artifacts, layers) {
  let diagram = 'flowchart LR\n';

  const layerEntries = Object.entries(layers).filter(([, items]) => items.length > 0);

  layerEntries.forEach(([layerName, items]) => {
    const safeLayer = layerName.replace(/[^a-zA-Z0-9]/g, '');
    diagram += `    subgraph ${safeLayer} ["${layerName}"]\n`;
    items.forEach(item => {
      const id = (item.name || item).replace(/[^a-zA-Z0-9]/g, '_');
      const label = item.name || item;
      diagram += `        ${id}["${label}"]\n`;
    });
    diagram += '    end\n';
  });

  if (layerEntries.length >= 2) {
    const layerIds = layerEntries.map(([name]) => name.replace(/[^a-zA-Z0-9]/g, ''));
    for (let i = 0; i < layerIds.length - 1; i++) {
      diagram += `    ${layerIds[i]} --> ${layerIds[i + 1]}\n`;
    }
  }

  return diagram;
}

export function sequenceDiagram(actors, flows) {
  let diagram = 'sequenceDiagram\n';
  const declaredActors = new Set();
  actors.forEach(a => {
    if (!declaredActors.has(a.id)) {
      diagram += `    participant ${a.id} as ${a.label}\n`;
      declaredActors.add(a.id);
    }
  });
  diagram += '\n';

  flows.forEach(f => {
    if (!declaredActors.has(f.from)) {
      diagram += `    participant ${f.from}\n`;
      declaredActors.add(f.from);
    }
    if (!declaredActors.has(f.to)) {
      diagram += `    participant ${f.to}\n`;
      declaredActors.add(f.to);
    }
    diagram += `    ${f.from}->>+${f.to}: ${f.label}\n`;
  });

  if (flows.length > 0) {
    const lastFlow = flows[flows.length - 1];
    diagram += `    ${lastFlow.to}-->>-${lastFlow.from}: Response\n`;
  }

  return diagram;
}

export function erDiagram(tables, relationships) {
  let diagram = 'erDiagram\n';

  tables.forEach(table => {
    const safeName = (table.name || 'unknown').replace(/[^a-zA-Z0-9_]/g, '_');
    diagram += `    ${safeName} {\n`;
    (table.fields || []).forEach(f => {
      const safeType = (f.type || 'string').replace(/[^a-zA-Z0-9]/g, '');
      const safeFName = (f.name || 'field').replace(/[^a-zA-Z0-9_]/g, '_');
      diagram += `        ${safeType} ${safeFName}\n`;
    });
    diagram += '    }\n';
  });

  relationships.forEach(r => {
    const safeFrom = (r.from || 'unknown').replace(/[^a-zA-Z0-9_]/g, '_');
    const safeTo = (r.to || 'unknown').replace(/[^a-zA-Z0-9_]/g, '_');
    const label = r.label || 'references';
    diagram += `    ${safeFrom} ||--o{ ${safeTo} : "${label}"\n`;
  });

  return diagram;
}

export function dataFlowDiagram(sources, sinks, transforms) {
  let diagram = 'flowchart LR\n';

  const seen = new Set();

  sources.forEach(s => {
    const id = s.replace(/[^a-zA-Z0-9]/g, '_');
    if (!seen.has(id)) {
      diagram += `    ${id}[/"${s}"/]\n`;
      seen.add(id);
    }
  });

  transforms.forEach(t => {
    const id = t.replace(/[^a-zA-Z0-9]/g, '_');
    if (!seen.has(id)) {
      diagram += `    ${id}[["${t}"]]\n`;
      seen.add(id);
    }
  });

  sinks.forEach(s => {
    const id = s.replace(/[^a-zA-Z0-9]/g, '_');
    if (!seen.has(id)) {
      diagram += `    ${id}[\\"${s}"\\]\n`;
      seen.add(id);
    }
  });

  sources.forEach(s => {
    const srcId = s.replace(/[^a-zA-Z0-9]/g, '_');
    transforms.forEach(t => {
      const tId = t.replace(/[^a-zA-Z0-9]/g, '_');
      diagram += `    ${srcId} --> ${tId}\n`;
    });
  });

  sinks.forEach(s => {
    const sinkId = s.replace(/[^a-zA-Z0-9]/g, '_');
    transforms.forEach(t => {
      const tId = t.replace(/[^a-zA-Z0-9]/g, '_');
      diagram += `    ${tId} --> ${sinkId}\n`;
    });
  });

  return diagram;
}
