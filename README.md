# Sliding Panes (Andy Matuschak Mode) Obsidian Plugin
![GitHub Workflow Status](https://img.shields.io/github/workflow/status/deathau/sliding-panes-obsidian/Build%20obsidian%20plugin?logo=github&style=for-the-badge) [![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/deathau/sliding-panes-obsidian?style=for-the-badge&sort=semver)](https://github.com/deathau/sliding-panes-obsidian/releases/latest)

Sliding Panes (Andy Matuschak Mode) as a plugin for [Obsidian](https://obsidian.md).

![Screenshot](https://github.com/deathau/sliding-panes-obsidian/raw/master/screenshot.gif)

This plugin changes the way panes in the main workspace are handled — inspired by
the UI of [Andy Matuschak's notes](https://notes.andymatuschak.org/).  
Instead of shrinking the workspace to fit panels, the panels will remain a fixed
width and stack so you can scroll between them. Note headers are rotated and added
to the left of the pane like a spine, and will stack up as you scroll, allowing
easy navigation between them.

(Note: To open links in a new pane in Obsidian, ctrl/cmd click them)

### Other Features
- Note headers stack up on the right _as well as_ the left.
- Changing an active pane scrolls that pane into view.
- Togglable without having to copy CSS into your theme.

### Settings
There is a setting to enable or disable the sliding panes effect, which is also
registered as a command, so you can toggle it from the command pallette or
assign a hotkey in the settings.

There are also two settings for heading width (the width of the rotated header)
and the leaf width (the width of a single markdown page).

### Compatibility

Custom plugins are only available for Obsidian v0.9.7+.

The current API of this repo targets Obsidian **v0.9.7**. 

### Notes
This is all very expermental at the moment, so parts might not work, etc.

It still gets a bit slow if you're loading a lot of documents, so try not to
load too many at once.

## Installation

### From within Obsidian
From Obsidian v0.9.8, you can activate this plugin within Obsidian by doing the following:
- Open Settings > Third-party plugin
- Make sure Safe mode is **off**
- Click Browse community plugins
- Search for "Sliding Panes" (or "andy mode" 😉)
- Click Install
- Once installed, close the community plugins window and activate the newly installed plugin
#### Updates
You can follow the same procedure to update the plugin

### From GitHub
- Download the [Latest release](https://github.com/deathau/sliding-panes-obsidian/releases/latest)
- Extract the `sliding-panes-obsidian` folder from the zip to your vault's plugins folder: `<vault>/.obsidian/plugins/`  
Note: On some machines the `.obsidian` folder may be hidden. On MacOS you should be able to press `Command+Shift+Dot` to show the folder in Finder.
- Reload Obsidian
- If prompted about Safe Mode, you can disable safe mode and enable the plugin.
Otherwise head to Settings, third-party plugins, make sure safe mode is off and
enable Sliding Panes from there.

## Development

This project uses Typescript to provide type checking and documentation.  
The repo depends on the latest [plugin API](https://github.com/obsidianmd/obsidian-api) in Typescript Definition format, which contains TSDoc comments describing what it does.

**Note:** The Obsidian API is still in early alpha and is subject to change at any time!

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

## Pricing
Huh? This is an open-source plugin I made *for fun*. It's completely free.
However, if you absolutely *have* to send me money because you like it that
much, feel free to throw some coins in my hat via
[PayPal](https://paypal.me/deathau) or sponsor me via
[GitHub Sponsors](https://github.com/sponsors/deathau)

# Version History
## 3.0.2
- Update focusLeaf to scroll just far enough to make a leaf fully visible if it's out of view to the right (thanks @erichalldev)
- Activate adjacent leaf when active leaf is closed (thanks again, @erichalldev)
- Close leaves which happen to have a file open that is deleted

## v3.0.1
- Quick fix to prevent the plugin from affecting sidebars

## v3.0.0
### New Features (vs the CSS-only version)
- Note headers stack up on the right as well as the left.
- Changing active pane scrolls that pane into view.
- Togglable without having to copy CSS into your theme.
