# Sliding Panes (Andy Matuschak Mode) Obsidian Plugin
Sliding Panes (Andy Matuschak Mode) as a plugin for [Obsidian](https://obsidian.md).

This project uses Typescript to provide type checking and documentation.  
The repo depends on the latest [plugin API](https://github.com/obsidianmd/obsidian-api) in Typescript Definition format, which contains TSDoc comments describing what it does.

**Note:** The Obsidian API is still in early alpha and is subject to change at any time!

## Compatibility

Custom plugins are only available for Obsidian v0.9.7+.

The current API of this repo targets Obsidian **v0.9.7**. 

## How to install the plugin

- Download the [Latest release](https://github.com/deathau/sliding-panes-obsidian/releases/latest)
- Extract the `sliding-panes-obsidian` folder from the zip to your vault's plugins folder: `<vault>/.obsidian/plugins/`

## New Features (vs the CSS-only version)
- Note headers stack up on the right _as well as_ the left.
- Changing an active pane scrolls that pane into view.
- Togglable without having to copy CSS into your theme.

## Settings
There is a setting to enable or disable the sliding panes effect, which is also
registered as a command, so you can toggle it from the command pallette or
assign a hotkey in the settings.

There are also two settings for heading width (the width of the rotated header) and the leaf width (the width of a single markdown page).

## Notes
This is all very expermental at the moment, so parts might not work, etc.  
It still gets a bit slow if you're loading a lot of documents, so try not to load too many at once.

## Development
If you want to contribute to development and/or just customize it with your own
tweaks, you can do the following:
- Clone this repo.
- `npm i` or `yarn` to install dependencies
- `npm run build` to compile.
- Copy `manifest.json`, `main.js` and `styles.css` to a subfolder of your plugins
folder (e.g, `<vault>/.obsidian/plugins/sliding-panes-obsidian/`)
- Reload obsidian to see changes

Alternately, you can clone the repo directly into your plugins folder and once
dependencies are installed use `npm run dev` to start compilation in watch mode.  
You may have to reload obsidian (`ctrl+R`) to see changes.
