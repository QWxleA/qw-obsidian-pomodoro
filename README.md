# Alex's Obsidian Pomodoro Timer Plugin

A simple Pomodoro timer plugin for Obsidian that tracks completed Pomodoros in your daily notes. This plugin does as little as possible. Even the settings could be disabled but I hadf been wavering between the length of my pomodoros.

## Features

- Start and stop Pomodoro timers via commands (no UI needed, use *start pomodor* from the command prompt)
- Automatically tracks completed Pomodoros in your daily notes frontmatter
- Display timer status in the status bar
- Click on the status bar emoji to see remaining time and the stop and restart buttons
- Automatically switch between Pomodoros and breaks
- 15-minute breaks after every 3 completed Pomodoros
- Configurable Pomodoro and break durations

## Usage

1. Start a Pomodoro timer using the "Start Pomodoro" command
2. Timer shows in the status bar (🍅 for Pomodoro, ☕ for break)
3. Click on the status bar emoji to see remaining time and controls
4. When a Pomodoro completes, the counter in your daily note will automatically increment
5. After 3 Pomodoros, you'll automatically get a 15-minute break

## Settings

- **Pomodoro Length**: Duration of each Pomodoro session (default: 25 minutes)
- **Short Break Length**: Duration of short breaks (default: 5 minutes)
- **Long Break Length**: Duration of long breaks after 3 Pomodoros (default: 15 minutes)
- **Frontmatter Counter Name**: The name of the counter in your daily note frontmatter (default: "pomodoros")

## Installation

### From Obsidian Community Plugins (not sure yet, this is just copy-pasta)

1. Open Obsidian Settings
2. Go to Community Plugins
3. Search for "Pomodoro Timer"
4. Click Install and Enable

### Manual Installation

1. Download the latest release
2. Extract the zip file into your Obsidian vault's `.obsidian/plugins/` directory
3. Enable the plugin in Obsidian settings

## Daily Notes Integration

This plugin automatically adds and updates a *"pomodoros"* (configurable) count in your daily note's frontmatter. The format will be:

```yaml
---
pomodoros: 5
---
```

## Development

1. Clone this repo to your development folder
2. Run `npm i` to install dependencies
3. Run `npm run dev` to start compilation in watch mode
4. Copy over `main.js`, `manifest.json` to your vault's `.obsidian/plugins/obsidian-pomodoro-timer/` directory

## License

MIT