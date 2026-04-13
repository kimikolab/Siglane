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

### Prompt Editing

- Auto-split comma-separated prompts into lines
- Bracket-aware parsing — commas inside `()` `[]` `<>` are preserved
- Line-by-line editing — comma input auto-splits into multiple lines inheriting the group
- Drag-and-drop reordering
- Toggle each line ON/OFF
- Line duplicate (Ctrl+D / ⌘+D)
- Duplicate line highlighting — amber border on lines that appear more than once
- Weight control — slider + ±buttons + direct number input
- Special weight syntax detection — `((tag))`, `(tag)`, `[tag:0.8]` show effective weight (read-only)
- Positive / Negative prompt management with collapsible sections

### Grouping & Organization

- Assign lines to categories (Quality, Character, Hair, Clothing, etc.) via per-line badge or Select mode
- Outline view — group-based structural view with collapsible groups and group-level ON/OFF toggle
- Flat view — simple list with drag-and-drop reordering
- Auto-grouping — tags automatically assigned to their default group based on prior grouping history
- Auto-detect negative tags — tags previously used in negative prompts are flagged automatically

### Select Mode

- Unified selection across Positive/Negative with sticky action bar
- Bulk operations — Set Group, ON, OFF, Ungroup, Delete, Bulk Notes
- Save selection as preset / replace selection with preset
- Multi-drag reorder — drag multiple selected items together in Flat view with stacked overlay
- Shift-click for range selection, group header click for group-wide selection

### Dictionary & Presets

- Dictionary management view — full-screen browsing, editing, and managing of dictionary entries with Select mode for bulk operations
- Preset management — tree-structured preset browser with hierarchical categories
- Save a group as a named preset, replace a group with a saved preset
- Right panel quick access — browse Dictionary and Presets while editing prompts

### Annotations

- Add descriptions to prompt tags (e.g. `masterpiece` → "highest quality tag"), displayed inline below each line
- Stored globally across all sessions
- Bulk Notes — export unannotated tags as JSON, paste into external AI for translation, import descriptions back in bulk
- Bulk Notes filters — Unannotated, Missing group, or All tags
- LLM auto-fill — send unannotated tags to Ollama for automatic annotation (configurable model and connection)

### ComfyUI Integration

- Workflow import/export — import a workflow JSON to auto-extract P/N prompts and generation params, edit in Siglane, export with prompts written back
- API integration — import API format workflow, send prompts directly to ComfyUI via `/prompt` endpoint (Ctrl+Enter shortcut)
- Generation parameter panel — edit seed (random/fixed), cfg, steps, sampler, scheduler, denoise, width/height directly in Siglane
- Resolution controls — width/height editing with swap button (when EmptyLatentImage node detected)
- Connection settings — configurable ComfyUI server URL with connection test
- Generation history — receive generated images from ComfyUI via history polling, displayed with thumbnails in the right panel
- PNG import — import ComfyUI-generated PNG files to extract embedded metadata and set session thumbnail
- Image lightbox — click to enlarge generation history images
- Favorites and image download in generation history

### Session & Data Management

- Session management — multiple sessions with create, rename, duplicate, delete
- Templates — lock a session as read-only, click to create a working copy
- Folder system — 2-level nesting (project → character → sessions), context menu with Move to / New subfolder, folder path breadcrumb in header
- Session thumbnail — auto-set from first generation result
- Collapsible sidebar with delete confirmation dialogs
- Right panel — collapsible side panel with History, Dictionary, and Presets tabs
- Data export/import — full backup of all sessions, dictionary, annotations, and settings as a single JSON file
- Reconstructed prompt display with one-click copy
- Memo field for generation parameters (seed, cfg, etc.)
- Auto-save via localStorage

### Planned

- Preset path-based organization (e.g. "Misaki/casual", "Misaki/formal")
- Co-occurrence analysis — find commonly paired prompt elements
- Prompt history and diff comparison
- img2img workflow support — image upload area for LoadImage nodes
- MCP integration — expose dictionary, annotations, and sessions as CRUD API for external LLMs
- Browser extension
- Cloud sync via Google Drive (Pro)

---

## Concept

Siglane is not just a prompt formatter — it is an environment for treating prompts as **structured, reusable assets**.

### Priorities

1. Ease of editing
2. Reusability (dictionary & presets)
3. Persistence
4. External integration

### Goals

- **MVP** ✅ — Make prompt editing comfortable
- **v1.5** ✅ — Direct generation from Siglane + prompt grouping
- **v2** ✅ — Turn prompts into reusable assets (presets + annotations + auto-grouping)
- **v3** ✅ — Generation history, dictionary browsing, right panel workflow
- **Future** — Become a prompt research environment

---

## Use Cases

- Organize long, complex prompts element by element
- Understand the structure of prompts shared by others
- Build a personal library of reusable prompt elements
- Speed up the trial-and-error cycle
- Manage prompts by project/character with folders
- Record generation results — prompts + parameters + images in one session
- Round-trip editing with ComfyUI via workflow JSON import/export
- Direct generation from Siglane — edit prompts, tweak parameters, hit Generate
- Group prompt lines by role and swap entire groups using saved presets
- Annotate prompt tags with descriptions — build a personal glossary across all sessions
- Bulk-translate unknown tags via external AI or local LLM and import annotations at once
- Export all data as a backup and import on another device

---

## Tech Stack

- React / Next.js
- TypeScript
- Tailwind CSS v4
- dnd-kit (drag and drop)
- Vercel (hosting)

---

## Data Storage

- Auto-save all sessions, dictionary, annotations, and settings via localStorage
- Full data export/import as JSON for backup and migration
- Future: IndexedDB migration, cloud sync via Google Drive

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
