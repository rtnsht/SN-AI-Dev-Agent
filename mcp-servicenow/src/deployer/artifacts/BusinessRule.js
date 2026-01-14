/**
 * Business Rule artifact deployer
 */
import { BaseArtifact } from './BaseArtifact.js';

export class BusinessRule extends BaseArtifact {
    get table() {
        return 'sys_script';
    }

    buildPayload(config, script) {
        return {
            name: config.name,
            collection: config.table,
            when: config.when || 'before',
            action_insert: config.insert ?? true,
            action_update: config.update ?? false,
            action_delete: config.delete ?? false,
            action_query: config.query ?? false,
            filter_condition: config.condition || '',
            script: script,
            active: config.active ?? true,
            order: config.order || 100,
            advanced: true
        };
    }
}

export default BusinessRule;

