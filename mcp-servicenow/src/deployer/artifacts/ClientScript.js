/**
 * Client Script artifact deployer
 */
import { BaseArtifact } from './BaseArtifact.js';

export class ClientScript extends BaseArtifact {
    get table() {
        return 'sys_script_client';
    }

    buildPayload(config, script) {
        return {
            name: config.name,
            table: config.table,
            type: config.type || 'onChange',
            field: config.field || '',
            script: script,
            active: config.active ?? true,
            description: config.description || '',
            ui_type: config.ui_type || 'Desktop',
            applies_to: config.applies_to || 'true'
        };
    }
}

export default ClientScript;

