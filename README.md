# Siglane

> Turn prompt chaos into control.

[![English](https://img.shields.io/badge/lang-English-blue)](README.md) [![日本語](https://img.shields.io/badge/lang-日本語-green)](README.ja.md)

Siglane is a web-based tool for editing, organizing, and reusing prompts for image generation AI — line by line.

**[Try it live →](https://siglane.vercel.app/)**

---

## What is Siglane?

Prompts for image generation AI tend to become long, comma-separated strings that are hard to read and tweak.

```text
masterpiece, best quality, 1girl, smile, blue hair, (soft lighting:1.2)
```

Siglane breaks them down into structured, editable lines:

![Siglane screenshot](docs/screenshot.png)

Shift from **writing** prompts to **operating** them.

---

## Features

- Auto-split comma-separated prompts into lines
- Bracket-aware parsing — commas inside `()` `[]` `<>` are preserved
- Line-by-line editing — comma input auto-splits into multiple lines inheriting the group
- Drag-and-drop reordering
- Toggle each line ON/OFF
- Line duplicate (Ctrl+D / ⌘+D)
- Weight control — slider + ±buttons + direct number input
- Special weight syntax detection — `((tag))`, `(tag)`, `[tag:0.8]` show effective weight (read-only)
- Positive / Negative prompt management
- Reconstructed prompt display with one-click copy
- Memo field for generation parameters (seed, cfg, etc.)
- Session management — multiple sessions with create, rename, duplicate, delete
- Templates — lock a session as read-only, click to create a working copy
- Folder system — 2-level nesting (project → character → sessions), context menu with Move to / New subfolder, folder path breadcrumb in header
- Collapsible sidebar with delete confirmation dialogs
- ComfyUI workflow import/export — import a workflow JSON to auto-extract P/N prompts and generation params (seed, steps, cfg, model, etc.), edit in Siglane, export with prompts written back
- ComfyUI API integration — import API format workflow, send prompts directly to ComfyUI via `/prompt` endpoint (Ctrl+Enter shortcut)
- Generation parameter panel — edit seed (random/fixed), cfg, steps, sampler, scheduler, denoise directly in Siglane without switching to ComfyUI
- Connection settings — configurable ComfyUI server URL with connection test
- Prompt line grouping — assign lines to categories (Quality, Character, Hair, Clothing, etc.) via multi-select mode or per-line badge click
- Per-section select mode — independent selection for Positive/Negative with action bar (Set Group, ON/OFF, Ungroup, All/None)
- Outline view — group-based structural view with collapsible groups, group-level ON/OFF toggle, and group header select
- Dictionary presets — save a group as a named preset, replace a group with a saved preset (existing lines turned OFF, preset lines inserted ON)
- Prompt annotations — add descriptions to prompt tags (e.g. `masterpiece` → "highest quality tag"), displayed inline below each line, stored globally across sessions
- Bulk notes — export unannotated tags, paste into external AI for translation, import descriptions back in bulk
- Auto-grouping — tags automatically assigned to their default group based on prior grouping history
- Auto-save via localStorage

### v2 (Planned)

- Prompt dictionary browsing UI (search, filter, manage presets)
- Preset path-based organization (e.g. "Misaki/casual", "Misaki/formal")
- JSON export / import for dictionary backup

### Future

- Prompt history and diff comparison
- Image display — receive generated images via WebSocket, attach to sessions
- img2img workflow support — image upload area for LoadImage nodes
- Tag search and related session discovery
- Co-occurrence analysis — find commonly paired prompt elements
- Browser extension
- Local bridge for external tool integration

---

## Concept

Siglane is not just a prompt formatter — it is an environment for treating prompts as **structured, reusable assets**.

### Priorities

1. Ease of editing
2. Reusability (dictionary)
3. Persistence
4. External integration

### Goals

- **MVP** ✅ — Make prompt editing comfortable
- **v1.5** ✅ — Direct generation from Siglane + prompt grouping
- **v2** ✅ — Turn prompts into reusable assets (presets + annotations + auto-grouping)
- **Future** — Become a prompt research environment

---

## Use Cases

- Organize long, complex prompts element by element
- Understand the structure of prompts shared by others
- Build a personal library of reusable prompt elements
- Speed up the trial-and-error cycle
- Manage prompts by project/character with folders
- Record successful generation results — prompts + parameters in one session
- Round-trip editing with ComfyUI via workflow JSON import/export
- Direct generation from Siglane — edit prompts, tweak cfg/steps/sampler, hit Generate
- Group prompt lines by role (Clothing, Hair, Expression) for quick identification and bulk operations
- Swap entire groups (e.g. replace formal outfit with casual) using saved presets
- Annotate prompt tags with descriptions — build a personal glossary that works across all sessions
- Bulk-translate unknown tags via external AI and import annotations at once
- Auto-group familiar tags — once grouped, tags are automatically categorized in new sessions

---

## Tech Stack

- React / Next.js
- TypeScript
- Tailwind CSS
- Vercel (hosting)

---

## Data Storage

- Auto-save all sessions via localStorage
- Future: JSON export / import, cloud sync

---

## Getting Started

```bash
npm install
npm run dev
```

### ComfyUI Integration Setup

To use the Generate feature (sending prompts directly to ComfyUI):

1. Start ComfyUI with CORS enabled:
   ```bash
   python main.py --enable-cors-header
   ```
2. In ComfyUI, open **Settings → Enable Dev mode options**
3. Save your workflow using **Save (API Format)**
4. In Siglane, click **Generate** → load the API format JSON
5. Edit prompts and generation params in Siglane, then hit **Generate** (or Ctrl+Enter)

---

## Development Policy

- Build small, ship fast
- Dogfood relentlessly — turn frustrations into features
- Avoid over-engineering and premature UI polish

---

## License

MIT
