/**
 * Service Portal Artifact Tools
 * Tools for managing SP Widgets, Pages, Portals, Themes, CSS, Angular Providers, Headers/Footers
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ── Type coercion helpers (AI agents often send strings for booleans/numbers) ──
const coerceOptBool = (def: boolean) =>
  z.preprocess(
    (v) => (v === 'true' ? true : v === 'false' ? false : v === undefined ? undefined : v),
    z.boolean().optional().default(def)
  );
const coerceOptNum = (def: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && /^\d+$/.test(v) ? parseInt(v, 10) : v),
    z.number().optional().default(def)
  );

// Helper to build update-set capture result
function captureResult(client: ServiceNowClient, capture?: { moved: number; errors: string[] }) {
  if (!capture) return undefined;
  return {
    activeUpdateSet: client.activeUpdateSetId,
    moved: capture.moved,
    errors: capture.errors.length > 0 ? capture.errors : undefined
  };
}

// ============ SP WIDGETS ============

export const getSpWidgetsSchema = z.object({
  query: z.string().optional().describe('Encoded query filter (e.g., "nameLIKEdashboard")'),
  limit: coerceOptNum(50)
});

export const createSpWidgetSchema = z.object({
  name: z.string().describe('Display name of the widget'),
  id: z.string().describe('Unique widget ID (lowercase-hyphenated, e.g., "my-custom-widget")'),
  template: z.string().optional().default('').describe('HTML/Angular template body'),
  css: z.string().optional().default('').describe('SCSS/CSS styles'),
  client_script: z.string().optional().default('').describe('Client-side controller JavaScript'),
  script: z.string().optional().default('').describe('Server-side script (data object population)'),
  link: z.string().optional().default('').describe('Angular link function'),
  description: z.string().optional().default('').describe('Widget description'),
  data_table: z.string().optional().describe('Data table reference for the widget'),
  demo_data: z.string().optional().describe('JSON demo/sample data'),
  option_schema: z.string().optional().describe('JSON schema defining widget instance options'),
  has_preview: coerceOptBool(false).describe('Whether the widget has a preview'),
  controller_as: z.string().optional().default('c').describe('Angular controller alias')
});

// ============ SP PAGES ============

export const getSpPagesSchema = z.object({
  query: z.string().optional().describe('Encoded query filter (e.g., "titleLIKEhome")'),
  limit: coerceOptNum(50)
});

export const createSpPageSchema = z.object({
  id: z.string().describe('Unique page ID (lowercase-hyphenated, e.g., "my-custom-page")'),
  title: z.string().describe('Page title'),
  description: z.string().optional().default('').describe('Page description'),
  category: z.string().optional().describe('Page category'),
  internal: coerceOptBool(false).describe('Whether the page is internal-only'),
  public: coerceOptBool(false).describe('Whether the page is publicly accessible'),
  draft: coerceOptBool(false).describe('Whether the page is a draft'),
  omit_watcher: coerceOptBool(false).describe('Omit Angular watchers for performance')
});

// ============ SP PORTALS ============

export const getSpPortalsSchema = z.object({
  query: z.string().optional().describe('Encoded query filter'),
  limit: coerceOptNum(20)
});

export const createSpPortalSchema = z.object({
  title: z.string().describe('Portal title'),
  url_suffix: z.string().describe('URL suffix (e.g., "myportal" → /sp?id=myportal)'),
  homepage: z.string().optional().describe('sys_id of the homepage sp_page'),
  theme: z.string().optional().describe('sys_id of the sp_theme'),
  logo: z.string().optional().describe('Logo URL or sys_attachment reference'),
  css: z.string().optional().default('').describe('Portal-level custom CSS'),
  quick_start_config: z.string().optional().describe('Quick start configuration JSON'),
  default_: coerceOptBool(false).describe('Set as default portal'),
  enable_favorites: coerceOptBool(true).describe('Enable favorites feature')
});

// ============ SP THEMES ============

export const getSpThemesSchema = z.object({
  query: z.string().optional().describe('Encoded query filter'),
  limit: coerceOptNum(20)
});

export const createSpThemeSchema = z.object({
  name: z.string().describe('Theme name'),
  css_variables: z.string().optional().default('').describe('CSS variable overrides (SCSS format)'),
  header: z.string().optional().describe('sys_id of the sp_header_footer for the header'),
  footer: z.string().optional().describe('sys_id of the sp_header_footer for the footer'),
  navbar_fixed: coerceOptBool(true).describe('Whether the navbar is fixed at the top')
});

// ============ SP CSS ============

export const getSpCssSchema = z.object({
  query: z.string().optional().describe('Encoded query filter'),
  limit: coerceOptNum(50)
});

export const createSpCssSchema = z.object({
  name: z.string().describe('CSS include name'),
  css: z.string().describe('CSS/SCSS content')
});

// ============ SP ANGULAR PROVIDERS ============

export const getSpAngularProvidersSchema = z.object({
  query: z.string().optional().describe('Encoded query filter'),
  limit: coerceOptNum(50)
});

export const createSpAngularProviderSchema = z.object({
  name: z.string().describe('Provider name (camelCase)'),
  type: z.enum(['factory', 'service', 'directive', 'filter', 'provider']).describe('Angular provider type'),
  script: z.string().describe('Provider script body')
});

// ============ SP HEADER/FOOTER ============

export const getSpHeaderFootersSchema = z.object({
  query: z.string().optional().describe('Encoded query filter'),
  limit: coerceOptNum(20)
});

export const createSpHeaderFooterSchema = z.object({
  name: z.string().describe('Header/footer name'),
  template: z.string().optional().default('').describe('HTML/Angular template'),
  css: z.string().optional().default('').describe('CSS/SCSS styles'),
  client_script: z.string().optional().default('').describe('Client-side controller JavaScript'),
  script: z.string().optional().default('').describe('Server-side script'),
  link: z.string().optional().default('').describe('Angular link function')
});

// ============ IMPLEMENTATIONS ============

export async function getSpWidgets(client: ServiceNowClient, input: z.infer<typeof getSpWidgetsSchema>) {
  const records = await client.getRecords('sp_widget', {
    sysparm_query: input.query || '',
    sysparm_fields: 'sys_id,name,id,description,template,css,client_script,script,data_table,has_preview,controller_as',
    sysparm_limit: input.limit
  });

  return {
    success: true,
    count: records.length,
    widgets: records.map(r => ({
      sys_id: r.sys_id,
      name: r.name,
      id: r.id,
      description: r.description,
      data_table: r.data_table,
      has_preview: r.has_preview,
      controller_as: r.controller_as
    }))
  };
}

export async function createSpWidget(client: ServiceNowClient, input: z.infer<typeof createSpWidgetSchema>) {
  const data: Record<string, unknown> = {
    name: input.name,
    id: input.id,
    template: input.template,
    css: input.css,
    client_script: input.client_script,
    script: input.script,
    link: input.link,
    description: input.description,
    has_preview: input.has_preview,
    controller_as: input.controller_as
  };
  if (input.data_table) data.data_table = input.data_table;
  if (input.demo_data) data.demo_data = input.demo_data;
  if (input.option_schema) data.option_schema = input.option_schema;

  const record = await client.createRecord('sp_widget', data);

  let updateSetCapture: { moved: number; errors: string[] } | undefined;
  if (client.activeUpdateSetId) {
    updateSetCapture = await client.moveArtifactToUpdateSet('sp_widget', record.sys_id);
  }

  return {
    success: true,
    message: `Widget "${input.name}" (${input.id}) created successfully`,
    sys_id: record.sys_id,
    name: input.name,
    id: input.id,
    updateSetCapture: captureResult(client, updateSetCapture)
  };
}

export async function getSpPages(client: ServiceNowClient, input: z.infer<typeof getSpPagesSchema>) {
  const records = await client.getRecords('sp_page', {
    sysparm_query: input.query || '',
    sysparm_fields: 'sys_id,id,title,description,category,internal,public,draft',
    sysparm_limit: input.limit
  });

  return {
    success: true,
    count: records.length,
    pages: records.map(r => ({
      sys_id: r.sys_id,
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      internal: r.internal,
      public: r.public,
      draft: r.draft
    }))
  };
}

export async function createSpPage(client: ServiceNowClient, input: z.infer<typeof createSpPageSchema>) {
  const data = {
    id: input.id,
    title: input.title,
    description: input.description,
    category: input.category || '',
    internal: input.internal,
    public: input.public,
    draft: input.draft,
    omit_watcher: input.omit_watcher
  };

  const record = await client.createRecord('sp_page', data);

  let updateSetCapture: { moved: number; errors: string[] } | undefined;
  if (client.activeUpdateSetId) {
    updateSetCapture = await client.moveArtifactToUpdateSet('sp_page', record.sys_id);
  }

  return {
    success: true,
    message: `Page "${input.title}" (${input.id}) created successfully`,
    sys_id: record.sys_id,
    id: input.id,
    title: input.title,
    updateSetCapture: captureResult(client, updateSetCapture)
  };
}

export async function getSpPortals(client: ServiceNowClient, input: z.infer<typeof getSpPortalsSchema>) {
  const records = await client.getRecords('sp_portal', {
    sysparm_query: input.query || '',
    sysparm_fields: 'sys_id,title,url_suffix,homepage,theme,default,enable_favorites',
    sysparm_limit: input.limit
  });

  return {
    success: true,
    count: records.length,
    portals: records.map(r => ({
      sys_id: r.sys_id,
      title: r.title,
      url_suffix: r.url_suffix,
      homepage: r.homepage,
      theme: r.theme,
      default: r.default,
      enable_favorites: r.enable_favorites
    }))
  };
}

export async function createSpPortal(client: ServiceNowClient, input: z.infer<typeof createSpPortalSchema>) {
  const data: Record<string, unknown> = {
    title: input.title,
    url_suffix: input.url_suffix,
    css: input.css,
    default: input.default_,
    enable_favorites: input.enable_favorites
  };
  if (input.homepage) data.homepage = input.homepage;
  if (input.theme) data.theme = input.theme;
  if (input.logo) data.logo = input.logo;
  if (input.quick_start_config) data.quick_start_config = input.quick_start_config;

  const record = await client.createRecord('sp_portal', data);

  let updateSetCapture: { moved: number; errors: string[] } | undefined;
  if (client.activeUpdateSetId) {
    updateSetCapture = await client.moveArtifactToUpdateSet('sp_portal', record.sys_id);
  }

  return {
    success: true,
    message: `Portal "${input.title}" (/${input.url_suffix}) created successfully`,
    sys_id: record.sys_id,
    title: input.title,
    url_suffix: input.url_suffix,
    updateSetCapture: captureResult(client, updateSetCapture)
  };
}

export async function getSpThemes(client: ServiceNowClient, input: z.infer<typeof getSpThemesSchema>) {
  const records = await client.getRecords('sp_theme', {
    sysparm_query: input.query || '',
    sysparm_fields: 'sys_id,name,css_variables,header,footer,navbar_fixed',
    sysparm_limit: input.limit
  });

  return {
    success: true,
    count: records.length,
    themes: records.map(r => ({
      sys_id: r.sys_id,
      name: r.name,
      header: r.header,
      footer: r.footer,
      navbar_fixed: r.navbar_fixed
    }))
  };
}

export async function createSpTheme(client: ServiceNowClient, input: z.infer<typeof createSpThemeSchema>) {
  const data: Record<string, unknown> = {
    name: input.name,
    css_variables: input.css_variables,
    navbar_fixed: input.navbar_fixed
  };
  if (input.header) data.header = input.header;
  if (input.footer) data.footer = input.footer;

  const record = await client.createRecord('sp_theme', data);

  let updateSetCapture: { moved: number; errors: string[] } | undefined;
  if (client.activeUpdateSetId) {
    updateSetCapture = await client.moveArtifactToUpdateSet('sp_theme', record.sys_id);
  }

  return {
    success: true,
    message: `Theme "${input.name}" created successfully`,
    sys_id: record.sys_id,
    name: input.name,
    updateSetCapture: captureResult(client, updateSetCapture)
  };
}

export async function getSpCss(client: ServiceNowClient, input: z.infer<typeof getSpCssSchema>) {
  const records = await client.getRecords('sp_css', {
    sysparm_query: input.query || '',
    sysparm_fields: 'sys_id,name,css',
    sysparm_limit: input.limit
  });

  return {
    success: true,
    count: records.length,
    cssIncludes: records.map(r => ({
      sys_id: r.sys_id,
      name: r.name,
      css: r.css
    }))
  };
}

export async function createSpCss(client: ServiceNowClient, input: z.infer<typeof createSpCssSchema>) {
  const data = {
    name: input.name,
    css: input.css
  };

  const record = await client.createRecord('sp_css', data);

  let updateSetCapture: { moved: number; errors: string[] } | undefined;
  if (client.activeUpdateSetId) {
    updateSetCapture = await client.moveArtifactToUpdateSet('sp_css', record.sys_id);
  }

  return {
    success: true,
    message: `CSS Include "${input.name}" created successfully`,
    sys_id: record.sys_id,
    name: input.name,
    updateSetCapture: captureResult(client, updateSetCapture)
  };
}

export async function getSpAngularProviders(client: ServiceNowClient, input: z.infer<typeof getSpAngularProvidersSchema>) {
  const records = await client.getRecords('sp_angular_provider', {
    sysparm_query: input.query || '',
    sysparm_fields: 'sys_id,name,type,script',
    sysparm_limit: input.limit
  });

  return {
    success: true,
    count: records.length,
    angularProviders: records.map(r => ({
      sys_id: r.sys_id,
      name: r.name,
      type: r.type,
      script: r.script
    }))
  };
}

export async function createSpAngularProvider(client: ServiceNowClient, input: z.infer<typeof createSpAngularProviderSchema>) {
  const data = {
    name: input.name,
    type: input.type,
    script: input.script
  };

  const record = await client.createRecord('sp_angular_provider', data);

  let updateSetCapture: { moved: number; errors: string[] } | undefined;
  if (client.activeUpdateSetId) {
    updateSetCapture = await client.moveArtifactToUpdateSet('sp_angular_provider', record.sys_id);
  }

  return {
    success: true,
    message: `Angular Provider "${input.name}" (${input.type}) created successfully`,
    sys_id: record.sys_id,
    name: input.name,
    type: input.type,
    updateSetCapture: captureResult(client, updateSetCapture)
  };
}

export async function getSpHeaderFooters(client: ServiceNowClient, input: z.infer<typeof getSpHeaderFootersSchema>) {
  const records = await client.getRecords('sp_header_footer', {
    sysparm_query: input.query || '',
    sysparm_fields: 'sys_id,name,template,css,client_script,script',
    sysparm_limit: input.limit
  });

  return {
    success: true,
    count: records.length,
    headerFooters: records.map(r => ({
      sys_id: r.sys_id,
      name: r.name,
      template: r.template,
      css: r.css
    }))
  };
}

export async function createSpHeaderFooter(client: ServiceNowClient, input: z.infer<typeof createSpHeaderFooterSchema>) {
  const data = {
    name: input.name,
    template: input.template,
    css: input.css,
    client_script: input.client_script,
    script: input.script,
    link: input.link
  };

  const record = await client.createRecord('sp_header_footer', data);

  let updateSetCapture: { moved: number; errors: string[] } | undefined;
  if (client.activeUpdateSetId) {
    updateSetCapture = await client.moveArtifactToUpdateSet('sp_header_footer', record.sys_id);
  }

  return {
    success: true,
    message: `Header/Footer "${input.name}" created successfully`,
    sys_id: record.sys_id,
    name: input.name,
    updateSetCapture: captureResult(client, updateSetCapture)
  };
}
