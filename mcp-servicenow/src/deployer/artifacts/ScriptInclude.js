/**
 * Script Include artifact deployer
 */
import { BaseArtifact } from './BaseArtifact.js';

export class ScriptInclude extends BaseArtifact {
    get table() {
        return 'sys_script_include';
    }

    buildPayload(config, script) {
        return {
            name: config.name,
            api_name: config.api_name || `global.${config.name}`,
            script: script,
            client_callable: config.client_callable ?? true,
            access: config.access || 'public',
            active: config.active ?? true,
            description: config.description || ''
        };
    }
}

export default ScriptInclude;

