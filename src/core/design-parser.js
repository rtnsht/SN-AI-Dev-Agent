/**
 * Design Document Parser
 * Parses 2-design.md to extract structured data for diagram generation.
 */

import { logger } from '../utils/logger.js';

export class DesignParser {
  constructor() {
    this.data = {
      artifacts: [],
      dataModel: { tables: [], changes: [] },
      integrations: { internal: [], external: [] },
      security: { roles: [], acls: [] }
    };
  }

  parse(markdownContent) {
    logger.info('Parsing design document...');

    this.data.artifacts = this.parseArtifactsTable(markdownContent);
    this.data.dataModel = this.parseDataModel(markdownContent);
    this.data.integrations = this.parseIntegrations(markdownContent);
    this.data.security = this.parseSecurity(markdownContent);

    logger.success(`Parsed: ${this.data.artifacts.length} artifacts, ` +
      `${this.data.dataModel.tables.length} tables, ` +
      `${this.data.integrations.internal.length + this.data.integrations.external.length} integrations`);

    return this.data;
  }

  parseArtifactsTable(content) {
    const artifacts = [];
    const section = this.extractSection(content, '4.2', '4.3') ||
                    this.extractSection(content, 'Summary Table', 'Deployment');
    if (!section) return artifacts;

    const rows = this.parseMarkdownTable(section);
    rows.forEach(row => {
      const name = row['Artifact'] || row['Name'] || row['artifact'] || '';
      const type = row['Type'] || row['type'] || '';
      const table = row['REST Table'] || row['Table'] || row['table'] || '';
      const description = row['Description'] || row['description'] || '';
      if (name && type) {
        artifacts.push({
          name: name.trim(),
          type: this.normalizeArtifactType(type.trim()),
          table: table.trim(),
          description: description.trim()
        });
      }
    });

    return artifacts;
  }

  parseDataModel(content) {
    const tables = [];
    const changes = [];

    const newTablesSection = this.extractSection(content, '5.1', '5.2') ||
                             this.extractSection(content, 'New Tables', 'Table Schema');
    if (newTablesSection) {
      const rows = this.parseMarkdownTable(newTablesSection);
      rows.forEach(row => {
        const name = row['Table'] || row['table'] || '';
        if (name) {
          tables.push({
            name: name.trim(),
            label: (row['Label'] || row['label'] || '').trim(),
            extends: (row['Extends'] || row['extends'] || '').trim(),
            fields: []
          });
        }
      });
    }

    const schemaSection = this.extractSection(content, '5.2', '5.3') ||
                          this.extractSection(content, 'Table Schema', 'Existing Table');
    if (schemaSection) {
      const rows = this.parseMarkdownTable(schemaSection);
      rows.forEach(row => {
        const column = row['Column'] || row['column'] || row['element'] || '';
        const type = row['Type'] || row['type'] || '';
        if (column && tables.length > 0) {
          tables[tables.length - 1].fields.push({
            name: column.trim(),
            type: type.trim(),
            mandatory: (row['Mandatory'] || row['mandatory'] || '').toLowerCase() === 'yes',
            reference: (row['Reference'] || row['reference'] || '').trim()
          });
        }
      });
    }

    const changesSection = this.extractSection(content, '5.3', '6') ||
                           this.extractSection(content, 'Existing Table Changes', 'Integration');
    if (changesSection) {
      const rows = this.parseMarkdownTable(changesSection);
      rows.forEach(row => {
        const table = row['Table'] || row['table'] || '';
        const changeType = row['Change Type'] || row['change_type'] || '';
        const details = row['Details'] || row['details'] || '';
        if (table) {
          changes.push({ table: table.trim(), change: changeType.trim(), details: details.trim() });
        }
      });
    }

    return { tables, changes };
  }

  parseIntegrations(content) {
    const internal = [];
    const external = [];

    const internalSection = this.extractSection(content, '6.1', '6.2') ||
                            this.extractSection(content, 'Internal Integrations', 'External');
    if (internalSection) {
      const rows = this.parseMarkdownTable(internalSection);
      rows.forEach(row => {
        internal.push({
          system: (row['System'] || row['system'] || '').trim(),
          direction: (row['Direction'] || row['direction'] || '').trim(),
          method: (row['Method'] || row['method'] || '').trim(),
          purpose: (row['Purpose'] || row['purpose'] || '').trim()
        });
      });
    }

    const externalSection = this.extractSection(content, '6.2', '7') ||
                            this.extractSection(content, 'External Integrations', 'Security');
    if (externalSection) {
      const rows = this.parseMarkdownTable(externalSection);
      rows.forEach(row => {
        external.push({
          system: (row['System'] || row['system'] || '').trim(),
          direction: (row['Direction'] || row['direction'] || '').trim(),
          protocol: (row['Protocol'] || row['protocol'] || '').trim(),
          authentication: (row['Authentication'] || row['authentication'] || '').trim()
        });
      });
    }

    return { internal, external };
  }

  parseSecurity(content) {
    const roles = [];
    const acls = [];

    const accessSection = this.extractSection(content, '7.1', '7.2') ||
                          this.extractSection(content, 'Access Control', 'ACLs');
    if (accessSection) {
      const rows = this.parseMarkdownTable(accessSection);
      rows.forEach(row => {
        const role = row['Role'] || row['role'] || '';
        if (role) {
          roles.push({
            role: role.trim(),
            accessLevel: (row['Access Level'] || row['access_level'] || '').trim(),
            restrictions: (row['Restrictions'] || row['restrictions'] || '').trim()
          });
        }
      });
    }

    const aclSection = this.extractSection(content, '7.2', '8') ||
                       this.extractSection(content, 'ACLs Required', 'Performance');
    if (aclSection) {
      const rows = this.parseMarkdownTable(aclSection);
      rows.forEach(row => {
        const table = row['Table'] || row['table'] || '';
        if (table) {
          acls.push({
            table: table.trim(),
            operation: (row['Operation'] || row['operation'] || '').trim(),
            role: (row['Role'] || row['role'] || '').trim(),
            script: (row['Script'] || row['script'] || '').trim()
          });
        }
      });
    }

    return { roles, acls };
  }

  extractSection(content, startMarker, endMarker) {
    const lines = content.split('\n');
    let capturing = false;
    let captured = [];

    for (const line of lines) {
      const isHeading = /^#{1,4}\s/.test(line);
      if (isHeading) {
        if (line.includes(startMarker)) {
          capturing = true;
          continue;
        }
        if (capturing && endMarker && line.includes(endMarker)) {
          break;
        }
      }
      if (capturing) captured.push(line);
    }

    return captured.length > 0 ? captured.join('\n') : null;
  }

  parseMarkdownTable(content) {
    const lines = content.split('\n').filter(l => l.trim().startsWith('|'));
    if (lines.length < 2) return [];

    const headerLine = lines[0];
    const headers = headerLine.split('|')
      .map(h => h.trim())
      .filter(h => h && !h.match(/^[-:]+$/));

    const dataLines = lines.slice(2);

    return dataLines.map(line => {
      const cells = line.split('|').map(c => c.trim()).filter(c => c);
      const row = {};
      headers.forEach((h, i) => {
        row[h] = cells[i] || '';
      });
      return row;
    }).filter(row => Object.values(row).some(v => v && v !== ''));
  }

  normalizeArtifactType(type) {
    const typeMap = {
      'Script Include': 'script_include',
      'Business Rule': 'business_rule',
      'Client Script': 'client_script',
      'UI Policy': 'ui_policy',
      'UI Policy Action': 'ui_policy_action',
      'Custom Field': 'field',
      'Event': 'event',
      'Notification': 'notification',
      'Custom Table': 'table',
      'Flow': 'flow',
      'Scheduled Job': 'scheduled_job',
      'ACL': 'acl'
    };
    return typeMap[type] || type.toLowerCase().replace(/\s+/g, '_');
  }
}

export default DesignParser;
