# Hardcoded "Yantra" References

> **Generated**: 2026-03-15
> **Purpose**: Audit of all hardcoded "Yantra" strings for future rebranding or cleanup
> **Total**: 25 references across 7 files

---

## Source Code (ServiceNow Integration) — 4 references

These are **functional code** references that would need updating if rebranding.

### `mcp-servicenow/lib/import-via-updateset.js`
| Line | Hardcoded Value |
|------|----------------|
| 29 | `<application display_value="Yantra AI Dev Agent">2ea695fec3d7321034b6b1f1b40131f0</application>` |
| 30 | `<application_name>Yantra AI Dev Agent</application_name>` |
| 31 | `<application_scope>x_snc_yantra</application_scope>` |

### `mcp-servicenow/lib/import-scoped-flow.js`
| Line | Hardcoded Value |
|------|----------------|
| 66 | `const scopeId = process.argv[3] \|\| '2ea695fec3d7321034b6b1f1b40131f0'; // x_snc_yantra` |

---

## Documentation & Config Files — 21 references

These are **documentation-only** references (no runtime impact).

### `CLAUDE.md`
| Line | Content |
|------|---------|
| 11 | `**Project**: Yantra - AI Dev Agent - SN` |
| 436 | `NEXT_PUBLIC_APP_NAME` default: `"Yantra - AI Dev Agent - SN"` |
| 438 | `NEXT_PUBLIC_HERO_TAGLINE` default: `"Yantra works for you."` |
| 439 | `NEXT_PUBLIC_APP_LOGO` default: `"/yantra-logo.png"` |

### `CLAUDE-backup.md`
| Line | Content |
|------|---------|
| 11 | `**Project**: Yantra - AI Dev Agent - SN` |
| 474 | `Yantra AI Dev Agent (x_snc_yantra)` — scope example |
| 479 | `User: "Use Yantra AI Dev Agent"` — example dialog |
| 481 | `Agent: "Selected scope: Yantra AI Dev Agent (x_snc_yantra)` |
| 515 | `"name": "yantra-ai-dev-agent"` — package name example |
| 516 | `"scope": "x_snc_yantra"` — scope example |
| 520 | `"yantra-dev": {` — auth profile name |
| 534 | `npx now-sdk install --auth yantra-dev --reinstall` |
| 537 | `npx now-sdk install --auth yantra-dev` |

### `PROJECT-TRACKER.md`
| Line | Content |
|------|---------|
| 1 | `# Project Tracker — Yantra - AI Dev Agent - SN Web App` |
| 61 | `App Branding — Yantra` task entry |
| 120 | `App branding — Yantra` checklist item |

### `README.md`
| Line | Content |
|------|---------|
| 146 | `Yantra uses three layers to ensure reliable capture` |

### `docs/architecture/architecture.md`
| Line | Content |
|------|---------|
| 1270 | `NEXT_PUBLIC_APP_NAME` default: `"Yantra - AI Dev Agent - SN"` |
| 1272 | `NEXT_PUBLIC_HERO_TAGLINE` default: `"Yantra works for you."` |
| 1273 | `NEXT_PUBLIC_APP_LOGO` default: `"/yantra-logo.png"` |

### `blog/linkedin-teaser-part1.md`
| Line | Content |
|------|---------|
| 50 | `**Yantra** — an AI Dev Agent for ServiceNow.` |

---

## Already Configurable (No Hardcoding)

The **webapp UI** (`webapp/src/`) does **not** contain any hardcoded "Yantra" strings. All branding is loaded dynamically from environment variables via `webapp/src/lib/branding.ts`:

| Env Variable | Controls |
|-------------|----------|
| `NEXT_PUBLIC_APP_NAME` | App title displayed in header |
| `NEXT_PUBLIC_APP_TAGLINE` | Tagline text |
| `NEXT_PUBLIC_HERO_TAGLINE` | Hero section tagline |
| `NEXT_PUBLIC_APP_LOGO` | Logo image path |

---

## Rebranding Checklist

If rebranding away from "Yantra":

- [ ] Update `mcp-servicenow/lib/import-via-updateset.js` (lines 29-31)
- [ ] Update `mcp-servicenow/lib/import-scoped-flow.js` (line 66)
- [ ] Update `.env` / environment variables for webapp branding
- [ ] Update documentation files (CLAUDE.md, README.md, etc.)
- [ ] Replace `webapp/public/yantra-logo.png` with new logo
- [ ] Update ServiceNow scoped app name if applicable
