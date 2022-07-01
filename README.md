# Sliding Panes (Andy Matuschak Mode) Obsidian Plugin
[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/deathau/sliding-panes-obsidian?style=for-the-badge&sort=semver)](https://github.com/deathau/sliding-panes-obsidian/releases/latest)
![GitHub All Releases](https://img.shields.io/github/downloads/deathau/sliding-panes-obsidian/total?style=for-the-badge)

Sliding Panes (Andy Matuschak Mode) as a plugin for [Obsidian](https://obsidian.md).

![Screenshot](https://github.com/deathau/sliding-panes-obsidian/raw/master/screenshot.gif)

This plugin changes the way panes in the main workspace are handled — inspired by
the UI of [Andy Matuschak's notes](https://notes.andymatuschak.org/).  
Instead of shrinking the workspace to fit panels, the panels will remain a fixed
width (but resizable) and stack so you can scroll between them. Note headers are rotated and added
to the left of the pane like a spine (optional), and will stack up as you scroll (also optional), allowing
easy navigation between them.

(Note: To open links in a new pane in Obsidian, ctrl/cmd click them)

### Other Features
- Note headers stack up on the right _as well as_ the left.
- Changing an active pane scrolls that pane into view.
- Togglable without having to copy CSS into your theme.
- Togglable features, such as the rotated headers and stacking

### Settings
- **Toggle Sliding Panes** - Turns sliding panes on or off globally *(also available via command/hotkey)*
- **Leaf Auto Width** - If on, the width of the pane should fill the available space *(also available via command/hotkey)*
- **Leaf Width** - The default width of a single pane
- **Toggle rotated headers** - Rotates headers to use as spines *(also available via command/hotkey)*
- **Swap rotated header direction** - Swaps the direction of rotated headers  *(also available via command/hotkey)*
- **Toggle stacking** - Panes will stack up to the left and right *(also available via command/hotkey)*
- **Spine Width** - The width of the rotated header (or gap) for stacking

### Compatibility

Custom plugins are only available for Obsidian v0.9.7+.

The current API of this repo targets Obsidian **v0.10.9**. 

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
- Search for this plugin
- Click Install
- Once installed, close the community plugins window and activate the newly installed plugin
#### Updates
You can follow the same procedure to update the plugin

### From GitHub
- Download the Latest Release from the Releases section of the GitHub Repository
- Extract the plugin folder from the zip to your vault's plugins folder: `<vault>/.obsidian/plugins/`  
Note: On some machines the `.obsidian` folder may be hidden. On MacOS you should be able to press `Command+Shift+Dot` to show the folder in Finder.
- Reload Obsidian
- If prompted about Safe Mode, you can disable safe mode and enable the plugin.
Otherwise head to Settings, third-party plugins, make sure safe mode is off and
enable the plugin from there.

## Security
> Third-party plugins can access files on your computer, connect to the internet, and even install additional programs.

The source code of this plugin is available on GitHub for you to audit yourself, but installing plugins into Obsidian is currently a matter of trust.

I can assure you here that I do nothing to collect your data, send information to the internet or otherwise do anything nefarious with your system. However, be aware that I *could*, and you only have my word that I don't.

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
folder (e.g, `<vault>/.obsidian/plugins/<plugin-name>/`)
- Reload obsidian to see changes

Alternately, you can clone the repo directly into your plugins folder and once
dependencies are installed use `npm run dev` to start compilation in watch mode.  
You may have to reload obsidian (`ctrl+R`) to see changes.

## Pricing
Huh? This is an open-source plugin I made *for fun*. It's completely free.
However, if you absolutely *have* to send me money because you like it that
much, feel free to throw some coins in my hat via the following:

[![GitHub Sponsors](https://img.shields.io/github/sponsors/deathau?style=social)](https://github.com/sponsors/deathau)
[![Paypal](https://img.shields.io/badge/paypal-deathau-yellow?style=social&logo=paypal)](https://paypal.me/deathau)

# Version History

## 3.3.0
- Sliding panes should now work as expected in popout windows!
- Pane resizing is back (but not saved to the workspace)
- Some previous dodginess when toggling the plugin on and off and attempting to resize panes has been resolved
- (Some) optimisations to streamline and speed things up a little bit.

## 3.2.5
- Quick fix to prevent sliding panes in popout windows, as the experience is currently borked.

## 3.2.4
- Fixed some focus issues with Obsidian 0.15
- Added seperate options for desktop and mobile leaf width (thanks @Bevaz)

## 3.2.3
- Add an option to select text-orientation (thanks @yo-goto)
- Allow user to disable smooth animations (thanks @cfree3)

## 3.2.2
- Fixed closing notes activating the leftmost note
- Fixed position of search suggestions
- Properly remove custom styling when moving a pane into a sidebar
- Added the note title to the icon, so if your panes are stacked, but you're not rotating headers, you can hover over the icon to see the note title.

## 3.2.1
- Changed the name slightly to drop the "Matuschak". Sorry Andy, but your name's just a tad unwieldy...
- Styling tweaks to better center the elements of rotated headers
- Fixed the ugly shadow smudge introduced in the previous release
- Fixed a code typo which was causing issues with opening and closing background panes

## 3.2.0
- Added an "auto width" mode, where each pane will take up the available space between the spines on the left and right
- Fix suggestion container positioning for tags (and related console errors) - Thanks, yet again, Eric Hall
- Fixed orientation of emojis in rotated headers (thanks GreenChocho and NothingIsLost)
- Fixed an error when loading workspaces
- Fixed compatibility issues with MrJackphi's Backlinks into the document plugin

## 3.1.1
- Quick fix for rightmost header hiding and extra scrollbar

## 3.1.0
- Update the link suggestion container position (thanks again, @erichalldev)
- Add the option (and command palette command) to turn stacking off (i.e. slide-off mode, like the v1 of Andy's Mode CSS)
- Add the option (and command palette command) to make the rotated header titles face the other direction
- Add a command palette command to toggle rotated headers
- Allow pane resizing (except the last pane, because it doesn't have a handle currently)
- Fix an issue with switching to off-screen panes not animating correctly (can still jump without animation if you switch too far too quickly)

## 3.0.2
- Add a setting to disable rotated headers
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
