/**
 * Configuration Manager
 * Loads and manages configuration from files and environment variables
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class ConfigManager {
  constructor() {
    this.config = {};
    this.loaded = false;
  }

  load(configPath = 'config/default.yaml') {
    try {
      // Load YAML config
      const configFile = fs.readFileSync(path.resolve(configPath), 'utf8');
      this.config = yaml.load(configFile);
      
      // Replace environment variable placeholders
      this.resolveEnvVars(this.config);
      
      // Override with environment variables
      this.applyEnvOverrides();
      
      this.loaded = true;
      return this.config;
    } catch (error) {
      console.error(`Failed to load config: ${error.message}`);
      throw error;
    }
  }

  resolveEnvVars(obj) {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Replace ${VAR_NAME} with environment variable value
        obj[key] = obj[key].replace(/\$\{(\w+)\}/g, (match, varName) => {
          return process.env[varName] || match;
        });
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.resolveEnvVars(obj[key]);
      }
    }
  }

  applyEnvOverrides() {
    // Instance configuration overrides
    if (process.env.SN_INSTANCE_URL) {
      this.config.instance = this.config.instance || {};
      this.config.instance.url = process.env.SN_INSTANCE_URL;
    }
    if (process.env.SN_SCOPE) {
      this.config.development = this.config.development || {};
      this.config.development.default_scope = process.env.SN_SCOPE;
    }
    if (process.env.LOG_LEVEL) {
      this.config.logging = this.config.logging || {};
      this.config.logging.level = process.env.LOG_LEVEL;
    }
  }

  get(key, defaultValue = null) {
    if (!this.loaded) {
      this.load();
    }
    
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  }

  getInstanceConfig() {
    return {
      url: this.get('instance.url'),
      username: process.env.SN_USERNAME,
      password: process.env.SN_PASSWORD,
      clientId: process.env.SN_CLIENT_ID,
      clientSecret: process.env.SN_CLIENT_SECRET,
      authMethod: this.get('instance.auth_method', 'basic')
    };
  }
}

export const config = new ConfigManager();
export default config;

