/**
 * Artifact type registry
 * Maps artifact type names to their deployer classes
 */
import { ScriptInclude } from './ScriptInclude.js';
import { ClientScript } from './ClientScript.js';
import { BusinessRule } from './BusinessRule.js';

export const ArtifactTypes = {
    script_include: ScriptInclude,
    client_script: ClientScript,
    business_rule: BusinessRule
};

export { ScriptInclude, ClientScript, BusinessRule };

