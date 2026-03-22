# Changelog

All notable changes to the **SN AI Agent** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## Structure

Release notes are maintained in the [`changelog/`](./changelog/) folder:

| Folder | Audience | Contents |
|--------|----------|----------|
| [`changelog/public/`](./changelog/public/) | End users, GitHub | Functional and user-facing features only |
| [`changelog/private/`](./changelog/private/) | Internal team | Full details including admin, infra, security internals |

**Copy `changelog/public/` contents to a public GitHub repo. Never expose `changelog/private/`.**

---

## Releases

| Version | Date | Title | Public | Private |
|---------|------|-------|--------|---------|
| 0.1.0-beta.1 | 2026-03-23 | Inaugural Beta | [public](./changelog/public/2026-03-23_v0.1.0-beta.1.md) | [private](./changelog/private/2026-03-23_v0.1.0-beta.1.md) |

## Upcoming

| Public | Private |
|--------|---------|
| [upcoming](./changelog/public/upcoming.md) | [upcoming](./changelog/private/upcoming.md) |

---

## Versioning Strategy

This project uses **Semantic Versioning** with beta tags:

| Format | Example | When |
|--------|---------|------|
| `MAJOR.MINOR.PATCH-beta.N` | `0.1.0-beta.1` | Pre-release (current) |
| `MAJOR.MINOR.PATCH` | `1.0.0` | General availability |

**Naming conventions:**

| Item | Format | Example |
|------|--------|---------|
| Git tag | `vMAJOR.MINOR.PATCH-beta.N` | `v0.1.0-beta.1` |
| GitHub release title | `vX.Y.Z-beta.N — Title` | `v0.1.0-beta.1 — Inaugural Beta` |
| Changelog file | `YYYY-MM-DD_vX.Y.Z-beta.N.md` | `2026-03-23_v0.1.0-beta.1.md` |
| Next patch beta | increment N | `v0.1.0-beta.2` |
| Next feature beta | bump MINOR | `v0.2.0-beta.1` |
