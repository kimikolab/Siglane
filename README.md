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
- Line-by-line editing
- Drag-and-drop reordering
- Toggle each line ON/OFF
- Line duplicate (Ctrl+D / ⌘+D)
- Weight notation support (e.g. `(tag:1.2)`)
- Positive / Negative prompt management
- Reconstructed prompt display with one-click copy
- Memo field for generation parameters (seed, cfg, etc.)
- Auto-save via localStorage

### v2 (Planned)

- Prompt dictionary (register, browse, one-click insert)
- Weight slider
- JSON export / import

### Future

- API integration for image generation
- Prompt history and diff comparison
- Browser extension
- External tool integration (ComfyUI / SD WebUI)

---

## Concept

Siglane is not just a prompt formatter — it is an environment for treating prompts as **structured, reusable assets**.

### Priorities

1. Ease of editing
2. Reusability (dictionary)
3. Persistence
4. External integration

### Goals

- **MVP** — Make prompt editing comfortable
- **v2** — Turn prompts into reusable assets
- **Future** — Become a prompt research environment

---

## Use Cases

- Organize long, complex prompts element by element
- Understand the structure of prompts shared by others
- Build a personal library of reusable prompt elements
- Speed up the trial-and-error cycle

---

## Tech Stack

- React / Next.js
- TypeScript
- Tailwind CSS
- Vercel (hosting)

---

## Data Storage

- Auto-save via localStorage
- Future: JSON export / import, cloud sync

---

## Getting Started

```bash
npm install
npm run dev
```

---

## Development Policy

- Build small, ship fast
- Dogfood relentlessly — turn frustrations into features
- Avoid over-engineering and premature UI polish

---

## License

MIT
