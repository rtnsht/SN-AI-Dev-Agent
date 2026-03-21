/**
 * Diagram Generator
 * Orchestrates generation of Mermaid and text-based diagrams from design data.
 */

import { logger } from '../utils/logger.js';
import {
  systemContextDiagram,
  componentDiagram,
  sequenceDiagram,
  erDiagram,
  dataFlowDiagram
} from './diagram-templates.js';
import {
  textSystemContext,
  textComponentTree,
  textSequenceFlow
} from './text-diagram-generator.js';

export class DiagramGenerator {
  constructor(designData) {
    this.designData = designData;
    this.diagrams = { mermaid: {}, text: {} };
  }

  generateAll() {
    logger.info('Generating diagrams from design data...');

    const { artifacts = [], dataModel = {}, integrations = {} } = this.designData;

    // Mermaid diagrams
    this.diagrams.mermaid.systemContext = this.generateSystemContext(artifacts, integrations);
    this.diagrams.mermaid.component = this.generateComponent(artifacts);
    this.diagrams.mermaid.sequence = this.generateSequence(artifacts, integrations);

    if (dataModel.tables && dataModel.tables.length > 0) {
      this.diagrams.mermaid.er = this.generateER(dataModel);
    }

    if (integrations.internal?.length > 0 || integrations.external?.length > 0) {
      this.diagrams.mermaid.dataFlow = this.generateDataFlow(integrations);
    }

    // Text diagrams (ASCII fallback)
    this.diagrams.text.systemContext = this.generateTextSystemContext(artifacts, integrations);
    this.diagrams.text.component = this.generateTextComponent(artifacts);
    this.diagrams.text.sequence = this.generateTextSequence(artifacts);

    const diagramCount = Object.values(this.diagrams.mermaid).filter(Boolean).length +
                         Object.values(this.diagrams.text).filter(Boolean).length;
    logger.success(`Generated ${diagramCount} diagrams`);

    return this.diagrams;
  }

  generateSystemContext(artifacts, integrations) {
    const components = artifacts.map(a => ({
      id: this.toSafeId(a.name),
      label: a.name,
      type: a.type
    }));

    const external = [
      ...(integrations.internal || []).map(i => ({
        id: this.toSafeId(i.system || i.System),
        label: i.system || i.System,
        direction: i.direction || i.Direction
      })),
      ...(integrations.external || []).map(i => ({
        id: this.toSafeId(i.system || i.System),
        label: i.system || i.System,
        direction: i.direction || i.Direction
      }))
    ];

    return systemContextDiagram(components, external);
  }

  generateComponent(artifacts) {
    const layers = {
      presentation: artifacts.filter(a =>
        ['client_script', 'ui_policy', 'ui_action', 'sp_widget', 'sp_page'].includes(a.type)),
      businessLogic: artifacts.filter(a =>
        ['business_rule', 'script_include', 'flow'].includes(a.type)),
      dataAccess: artifacts.filter(a =>
        ['table', 'field', 'sys_dictionary'].includes(a.type)),
      integration: artifacts.filter(a =>
        ['rest_message', 'scripted_rest', 'import_set'].includes(a.type))
    };
    return componentDiagram(artifacts, layers);
  }

  generateSequence(artifacts, integrations) {
    const actors = [];
    const flows = [];

    if (artifacts.some(a => a.type === 'client_script' || a.type === 'ui_policy')) {
      actors.push({ id: 'User', label: 'User' });
      actors.push({ id: 'Browser', label: 'Browser/Form' });
    }
    actors.push({ id: 'ServiceNow', label: 'ServiceNow Platform' });

    const brArtifacts = artifacts.filter(a => a.type === 'business_rule');
    const siArtifacts = artifacts.filter(a => a.type === 'script_include');
    const csArtifacts = artifacts.filter(a => a.type === 'client_script');

    if (csArtifacts.length > 0) {
      flows.push({ from: 'User', to: 'Browser', label: 'Interact with form' });
      flows.push({ from: 'Browser', to: 'ServiceNow', label: csArtifacts[0].name });
    }

    if (brArtifacts.length > 0) {
      flows.push({ from: 'ServiceNow', to: 'ServiceNow', label: `Trigger: ${brArtifacts[0].name}` });
    }

    if (siArtifacts.length > 0) {
      flows.push({ from: 'ServiceNow', to: 'ServiceNow', label: `Call: ${siArtifacts[0].name}` });
    }

    (integrations.external || []).forEach(ext => {
      actors.push({ id: this.toSafeId(ext.system || ext.System), label: ext.system || ext.System });
      flows.push({
        from: 'ServiceNow',
        to: this.toSafeId(ext.system || ext.System),
        label: ext.purpose || ext.Purpose || 'Integration call'
      });
    });

    if (flows.length === 0) {
      actors.push({ id: 'User', label: 'User' });
      flows.push({ from: 'User', to: 'ServiceNow', label: 'Submit record' });
      flows.push({ from: 'ServiceNow', to: 'User', label: 'Return result' });
    }

    return sequenceDiagram(actors, flows);
  }

  generateER(dataModel) {
    const tables = (dataModel.tables || []).map(t => ({
      name: t.name || t.Table || t.table,
      fields: (t.fields || t.schema || []).map(f => ({
        name: f.name || f.Column || f.column || f.element,
        type: f.type || f.Type || f.internal_type || 'string'
      }))
    }));

    const relationships = [];
    (dataModel.changes || []).forEach(c => {
      if (c.change === 'reference' || (c.details && c.details.includes('reference'))) {
        relationships.push({
          from: c.table || c.Table,
          to: c.referenceTable || c.target || 'related_table',
          label: c.field || c.details || 'references'
        });
      }
    });

    return erDiagram(tables, relationships);
  }

  generateDataFlow(integrations) {
    const sources = [];
    const sinks = [];
    const transforms = ['ServiceNow'];

    (integrations.internal || []).forEach(i => {
      const sys = i.system || i.System;
      const dir = (i.direction || i.Direction || '').toLowerCase();
      if (dir === 'inbound') sources.push(sys);
      else if (dir === 'outbound') sinks.push(sys);
      else { sources.push(sys); sinks.push(sys); }
    });

    (integrations.external || []).forEach(i => {
      const sys = i.system || i.System;
      const dir = (i.direction || i.Direction || '').toLowerCase();
      if (dir === 'inbound') sources.push(sys);
      else if (dir === 'outbound') sinks.push(sys);
      else { sources.push(sys); sinks.push(sys); }
    });

    return dataFlowDiagram(sources, sinks, transforms);
  }

  generateTextSystemContext(artifacts, integrations) {
    const components = artifacts.map(a => a.name);
    return textSystemContext(components);
  }

  generateTextComponent(artifacts) {
    const layers = {
      'Business Logic': artifacts.filter(a => ['business_rule', 'script_include', 'flow'].includes(a.type)).map(a => a.name),
      'Presentation': artifacts.filter(a => ['client_script', 'ui_policy', 'sp_widget'].includes(a.type)).map(a => a.name),
      'Data': artifacts.filter(a => ['table', 'field'].includes(a.type)).map(a => a.name)
    };
    return textComponentTree(layers);
  }

  generateTextSequence(artifacts) {
    const steps = [];
    const cs = artifacts.filter(a => a.type === 'client_script');
    const br = artifacts.filter(a => a.type === 'business_rule');
    const si = artifacts.filter(a => a.type === 'script_include');

    if (cs.length > 0) steps.push(`User interacts with form → ${cs[0].name} fires`);
    if (br.length > 0) steps.push(`Record saved → ${br[0].name} triggers`);
    if (si.length > 0) steps.push(`Business rule calls → ${si[0].name}`);
    if (steps.length === 0) {
      steps.push('User submits record');
      steps.push('ServiceNow processes request');
      steps.push('Result returned to user');
    }

    return textSequenceFlow(steps);
  }

  toSafeId(str) {
    if (!str) return 'unknown';
    return str.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'node';
  }

  toMarkdownSection() {
    let md = '';

    if (this.diagrams.mermaid.systemContext) {
      md += '### 3.1 System Context Diagram\n\n';
      md += '```mermaid\n' + this.diagrams.mermaid.systemContext + '\n```\n\n';
    }

    if (this.diagrams.mermaid.component) {
      md += '### 3.2 Component Diagram\n\n';
      md += '```mermaid\n' + this.diagrams.mermaid.component + '\n```\n\n';
    }

    if (this.diagrams.mermaid.sequence) {
      md += '### 3.3 Sequence Diagram\n\n';
      md += '```mermaid\n' + this.diagrams.mermaid.sequence + '\n```\n\n';
    }

    if (this.diagrams.mermaid.er) {
      md += '### 3.4 Entity-Relationship Diagram\n\n';
      md += '```mermaid\n' + this.diagrams.mermaid.er + '\n```\n\n';
    }

    if (this.diagrams.mermaid.dataFlow) {
      md += '### 3.5 Data Flow Diagram\n\n';
      md += '```mermaid\n' + this.diagrams.mermaid.dataFlow + '\n```\n\n';
    }

    return md;
  }
}

export default DiagramGenerator;
