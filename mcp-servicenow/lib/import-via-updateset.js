#!/usr/bin/env node
/**
 * Import SDK Flow XML via Update Set (preserves scope)
 * This wraps the flow records in an Update Set and imports via sys_remote_update_set
 */
import axios from 'axios';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const url = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };

async function importViaUpdateSet(xmlFile) {
    const xmlContent = fs.readFileSync(xmlFile, 'utf-8');
    
    // Extract flow name for update set naming
    const nameMatch = xmlContent.match(/<name>([^<]+)<\/name>/);
    const flowName = nameMatch ? nameMatch[1] : 'SDK Flow';
    
    // Wrap in Update Set XML format
    const updateSetXml = `<?xml version="1.0" encoding="UTF-8"?>
<unload unload_date="2026-03-02 10:00:00">
<sys_remote_update_set action="INSERT_OR_UPDATE">
    <application display_value="SN AI Agent"></application>
    <application_name>SN AI Agent</application_name>
    <application_scope></application_scope>
    <application_version>1.0.0</application_version>
    <collisions/>
    <commit_date/>
    <deleted_on_remote/>
    <description>SDK-generated flow: ${flowName}</description>
    <name>SDK Import - ${flowName} - ${new Date().toISOString()}</name>
    <origin_sys_id/>
    <parent/>
    <release_date/>
    <remote_base_update_set/>
    <remote_parent_id/>
    <remote_sys_id>sdk_import_${Date.now()}</remote_sys_id>
    <state>loaded</state>
    <summary/>
    <sys_class_name>sys_remote_update_set</sys_class_name>
    <sys_created_by>admin</sys_created_by>
    <sys_created_on>2026-03-02 10:00:00</sys_created_on>
    <sys_id>sdk_us_${Date.now().toString(16)}</sys_id>
    <sys_mod_count>0</sys_mod_count>
    <sys_updated_by>admin</sys_updated_by>
    <sys_updated_on>2026-03-02 10:00:00</sys_updated_on>
    <update_set/>
    <update_source/>
</sys_remote_update_set>
${xmlContent}
</unload>`;

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     SDK Flow Import via Update Set                         ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n📁 File: ${xmlFile}`);
    console.log(`📦 Flow: ${flowName}`);
    console.log(`🌐 Instance: ${url}\n`);

    // Create a temporary file with the update set XML
    const tempFile = `/tmp/sdk-updateset-${Date.now()}.xml`;
    fs.writeFileSync(tempFile, updateSetXml);
    console.log(`📝 Created update set XML: ${tempFile}`);

    // Import via existing import-updateset tool
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    try {
        const result = await execAsync(`node ${path.join(__dirname, 'import-updateset.js')} ${tempFile} --direct`, {
            cwd: path.join(__dirname, '..')
        });
        console.log(result.stdout);
        if (result.stderr) console.log(result.stderr);
    } catch (e) {
        console.log('Import error:', e.message);
        if (e.stdout) console.log(e.stdout);
        if (e.stderr) console.log(e.stderr);
    }

    // Clean up
    fs.unlinkSync(tempFile);
}

const xmlFile = process.argv[2];
if (!xmlFile) {
    console.log('Usage: node lib/import-via-updateset.js <xml-file>');
    process.exit(1);
}

importViaUpdateSet(xmlFile).catch(e => console.error('Error:', e.message));

