# Task Grid

A lightweight, spreadsheet-style task and time planning/tracking tool for visual workload management.

![Task Grid](https://img.shields.io/badge/version-1.1-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## About

I didn't find an "exact" existing tool that meets my need so I'm making one here...

Inspired by and learning from existing tools (thanks!):
- [Apple Calendar](https://www.icloud.com/calendar)
- [iHour](https://app.ipad.ly/ihour)
- Excel / Google Sheets
- [gogh](https://gogh.gg/)
- etc. ...

## Development & Use

### Prerequisites

- Node.js 18+
- Rust (for Tauri)
- pnpm / npm / yarn

**Node.js** (v18+):
- Visit: https://nodejs.org/
- Download the LTS version
- Run the installer

**Rust**:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

**macOS only**:
```bash
xcode-select --install
```

### Setup

```bash
# Navigate to project folder
cd task-grid

# Install dependencies
npm install
```

### Test & Edit
```bash
npm run tauri dev
```

### Build/"output" the App to use
```bash
npm run tauri build
```

## Features

Some features/intended features (/developer's personal checklist, still working on this thing...)
If a future update made one of these unavailable, that change needs fix...

### Grid View
- **Spreadsheet-style layout** - Tasks as columns, dates as rows
- **Default start on "today"** - Grid opens centered on current date
- **Frozen headers** - Task names row and date column stay visible while scrolling
- **Today highlighting** - Current date row is visually emphasized
- **Quick navigation** - Jump to top/today/bottom buttons
- **Drag to reorder columns** - Remembers your preferred task order
- **Privacy Mode** - Blur all text for safe screenshots
- **Export CSV** - Export your data

### Cell Entries
- **Click to edit** - Click any cell to add/edit entry content
- **Copy/Cut/Paste** - Hover over cells to see clipboard actions
- **Auto-save on click outside** - For existing entries, clicking outside saves changes
- **Timer support** - Start/stop timer for any entry; continue timing while modal is closed
- **Multiple time records** - Track multiple work sessions per entry
- **Manual time entry** - Add time records manually

### Task Management
- **Task groups** - Organize tasks into groups
- **Archive tasks** - Remove from Grid while retaining data
- **Reorder tasks & groups** - Independent ordering from Grid columns
- **Task details** - View all occurrences and time spent per task
- **Undo delete** - Restore recently deleted tasks or entries

### Settings
- **Language** - English / 简体中文 (in progress)
- **Row height** - Normal / Thin / Fat rows
- **Column width** - Fixed width / Full text

### Demo Tasks
- **Load demo** - Try out the app with sample tasks
- Button in header or center of empty Grid

## Tech Stack

- **Frontend**: React + Vite
- **Desktop**: Tauri (Rust)
- **Database**: SQLite
- **Styling**: CSS

## Known Issues / TODO

- [ ] Confirmation before delete
- [ ] Click task name to edit - description not saving
- [ ] Chinese language UI (in progress)
- [ ] Demo task delete not working (can archive)
- [ ] Empty Grid "load demo" button positioning
- [ ] Keyboard shortcuts (Enter, ESC, Ctrl+C/V/X)
- [ ] Export task/task group from Management
- [ ] Recurrence options for entries
- [ ] Fixed width mode text truncation
- [ ] "Stop all timers" button
- [ ] Etc. ...

## License

MIT License - See [LICENSE](LICENSE) for details.

This project is for non-profit use.

## Acknowledgments

Thanks to the creators of Apple Calendar, iHour, Excel and Google Sheets, gogh, and other existing time/task management tools for inspiration. 

Thanks Claude Opus 4.5 & GPT 5.2 Thinking.

Thanks my friends who supported and enjoyed this.
