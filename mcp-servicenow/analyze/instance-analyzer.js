#!/usr/bin/env node
/**
 * Instance Analyzer - Comprehensive
 *
 * Analyzes a ServiceNow instance for ALL existing artifacts before implementing a requirement.
 * Should be run as Phase 0 (Discovery) before Design.
 *
 * Usage: node analyze/instance-analyzer.js --table=incident --keywords="high,impact,justification"
 */

import * as dotenv from 'dotenv';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const api = axios.create({
    baseURL: process.env.SN_INSTANCE_URL,
    auth: { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD },
    headers: { 'Accept': 'application/json' }
});

const args = process.argv.slice(2);
const tableArg = args.find(a => a.startsWith('--table='))?.split('=')[1] || 'incident';
const keywordsArg = args.find(a => a.startsWith('--keywords='))?.split('=')[1] || '';
const keywords = keywordsArg ? keywordsArg.split(',').map(k => k.trim()) : [];
const outputArg = args.find(a => a.startsWith('--output='))?.split('=')[1];

// ALL ServiceNow artifact types to check
// requireKeywords: true = skip if no keywords provided (for global artifacts)
const ARTIFACT_CHECKS = [
    // Core Development - Table-specific (always check)
    { name: 'Custom Fields', table: 'sys_dictionary', tableField: 'name', nameField: 'element', fields: 'element,column_label,internal_type' },
    { name: 'Business Rules', table: 'sys_script', tableField: 'collection', nameField: 'name', fields: 'name,when,order,sys_scope' },
    { name: 'Client Scripts', table: 'sys_script_client', tableField: 'table', nameField: 'name', fields: 'name,type,sys_scope' },
    { name: 'UI Policies', table: 'sys_ui_policy', tableField: 'table', nameField: 'short_description', fields: 'short_description,conditions,sys_scope' },
    { name: 'UI Actions', table: 'sys_ui_action', tableField: 'table', nameField: 'name', fields: 'name,action_name,order,sys_scope' },

    // Events & Notifications - Table-specific
    { name: 'Events', table: 'sysevent_register', tableField: 'table', nameField: 'event_name', fields: 'event_name,table,fired_by' },
    { name: 'Notifications', table: 'sysevent_email_action', tableField: 'collection', nameField: 'name', fields: 'name,event_name,sys_scope' },

    // Security - Table-specific
    { name: 'ACLs', table: 'sys_security_acl', tableField: 'name', nameField: 'name', fields: 'name,operation,type,sys_scope' },

    // Workflows - Table-specific
    { name: 'Workflows', table: 'wf_workflow', tableField: 'table', nameField: 'name', fields: 'name,table,sys_scope' },

    // Transform Maps - Table-specific
    { name: 'Transform Maps', table: 'sys_transform_map', tableField: 'target_table', nameField: 'name', fields: 'name,target_table,sys_scope' },

    // Global artifacts - REQUIRE keywords to search (otherwise too many results)
    { name: 'Script Includes', table: 'sys_script_include', tableField: null, nameField: 'name', fields: 'name,api_name,client_callable,sys_scope', requireKeywords: true },
    { name: 'Flows', table: 'sys_hub_flow', tableField: null, nameField: 'name', fields: 'name,active,sys_scope', requireKeywords: true },
    { name: 'Scheduled Jobs', table: 'sysauto_script', tableField: null, nameField: 'name', fields: 'name,run_type,sys_scope', requireKeywords: true },
    { name: 'Catalog Items', table: 'sc_cat_item', tableField: null, nameField: 'name', fields: 'name,short_description,active,sys_scope', requireKeywords: true },
    { name: 'Catalog Client Scripts', table: 'catalog_script_client', tableField: null, nameField: 'name', fields: 'name,type,sys_scope', requireKeywords: true },
    { name: 'Catalog UI Policies', table: 'catalog_ui_policy', tableField: null, nameField: 'short_description', fields: 'short_description,catalog_item,sys_scope', requireKeywords: true },
    { name: 'REST Messages', table: 'sys_rest_message', tableField: null, nameField: 'name', fields: 'name,rest_endpoint,sys_scope', requireKeywords: true },
    { name: 'Data Sources', table: 'sys_data_source', tableField: null, nameField: 'name', fields: 'name,type,sys_scope', requireKeywords: true },
    { name: 'Fix Scripts', table: 'sys_script_fix', tableField: null, nameField: 'name', fields: 'name,sys_scope', requireKeywords: true },
];

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('🔍 COMPREHENSIVE INSTANCE ANALYZER - Phase 0 Discovery');
console.log('═══════════════════════════════════════════════════════════════\n');
console.log(`Instance: ${process.env.SN_INSTANCE_URL}`);
console.log(`Table: ${tableArg}`);
console.log(`Keywords: ${keywords.length > 0 ? keywords.join(', ') : '(none - checking all)'}`);
console.log(`Artifact Types: ${ARTIFACT_CHECKS.length}\n`);

// Build keyword query helper
const buildKeywordQuery = (field) => {
    if (keywords.length === 0) return '';
    return keywords.map(k => `${field}LIKE${k}`).join('^OR');
};

async function analyzeArtifact(check) {
    try {
        // Skip global artifacts if no keywords provided
        if (check.requireKeywords && keywords.length === 0) {
            return { skipped: true, reason: 'Requires keywords' };
        }

        let query = 'active=true';

        // Add table filter if applicable
        if (check.tableField && tableArg) {
            query += `^${check.tableField}=${tableArg}`;
        }

        // Add keyword search
        const keywordQuery = buildKeywordQuery(check.nameField);
        if (keywordQuery) {
            query += `^(${keywordQuery})`;
        }

        const response = await api.get(`/api/now/table/${check.table}`, {
            params: {
                sysparm_query: query,
                sysparm_fields: check.fields + ',sys_id',
                sysparm_limit: 50
            }
        });

        return response.data.result || [];
    } catch (e) {
        return { error: e.message };
    }
}

async function analyze() {
    const results = {};

    for (const check of ARTIFACT_CHECKS) {
        process.stdout.write(`📋 Checking ${check.name}...`);
        const data = await analyzeArtifact(check);

        if (data.skipped) {
            console.log(` ⏭️  Skipped (${data.reason})`);
            results[check.name] = { count: 0, items: [], skipped: true };
        } else if (data.error) {
            console.log(` ❌ Error: ${data.error}`);
            results[check.name] = { error: data.error, count: 0, items: [] };
        } else {
            console.log(` Found: ${data.length}`);
            results[check.name] = { count: data.length, items: data };
        }
    }

    return results;
}

async function printReport(results) {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                    DISCOVERY REPORT');
    console.log('═══════════════════════════════════════════════════════════════\n');

    let totalArtifacts = 0;
    const icons = {
        'Custom Fields': '🏷️', 'Business Rules': '⚙️', 'Script Includes': '📦',
        'Client Scripts': '💻', 'UI Policies': '🎨', 'UI Actions': '🔘',
        'Events': '📡', 'Notifications': '📧', 'Email Scripts': '✉️',
        'ACLs': '🔒', 'Workflows': '🔄', 'Flows': '🌊',
        'Scheduled Jobs': '⏰', 'Catalog Items': '🛒', 'Catalog Client Scripts': '💻',
        'Catalog UI Policies': '🎨', 'Transform Maps': '🗺️', 'REST Messages': '🔗',
        'Data Sources': '💾', 'Fix Scripts': '🔧'
    };

    for (const [name, data] of Object.entries(results)) {
        if (data.count > 0) {
            const icon = icons[name] || '📋';
            console.log(`${icon} ${name.toUpperCase()}: (${data.count})`);

            // Show first 10 items
            data.items.slice(0, 10).forEach(item => {
                const displayName = item.name || item.element || item.short_description || item.event_name || 'unnamed';
                console.log(`   • ${displayName}`);
            });

            if (data.count > 10) {
                console.log(`   ... and ${data.count - 10} more`);
            }
            console.log('');
            totalArtifacts += data.count;
        }
    }

    // Summary table
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                    SUMMARY BY TYPE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('| Artifact Type | Count |');
    console.log('|---------------|-------|');
    for (const [name, data] of Object.entries(results)) {
        if (data.count > 0) {
            console.log(`| ${name} | ${data.count} |`);
        }
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`📊 TOTAL ARTIFACTS FOUND: ${totalArtifacts}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (totalArtifacts > 0) {
        console.log('⚠️  RECOMMENDATION:');
        console.log('   Review these existing artifacts before proceeding with implementation.');
        console.log('   You may be able to extend existing functionality instead of creating new.\n');
    } else {
        console.log('✅ No existing related artifacts found. Safe to proceed with new implementation.\n');
    }

    return totalArtifacts;
}

async function saveReport(results, outputPath) {
    const report = {
        instance: process.env.SN_INSTANCE_URL,
        table: tableArg,
        keywords: keywords,
        analyzedAt: new Date().toISOString(),
        summary: {},
        details: results
    };

    let total = 0;
    for (const [name, data] of Object.entries(results)) {
        report.summary[name] = data.count;
        total += data.count;
    }
    report.summary.total = total;

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved to: ${outputPath}\n`);
}

(async () => {
    const results = await analyze();
    const total = await printReport(results);

    // Save JSON report if output specified
    if (outputArg) {
        await saveReport(results, outputArg);
    }

    process.exit(total > 50 ? 1 : 0); // Exit with warning if too many artifacts found
})();

