# Andy Matuschak Mode Obsidian Plugin
Andy Matuschak Mode as a plugin. Utilizing the [volcano](https://github.com/kognise/volcano) unofficial plugin loader by [kognise](https://github.com/kognise/)

| | |
|--|--|
| ![Carl the Turtle](https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/60/google/56/turtle_1f422.png) | "The Volcano plugin system is UNOFFICIAL and UNSUPPORTED no matter how Kognise makes things sound, please use it at your own risk. We still love you though Kognise :purple_heart:" | 


(thanks Carl)

## New Features (vs the CSS-only version)
- Note headers stack up on the right _as well as_ the left
- Changing an active pane scrolls that pane into view

## Installation
1. Make sure [volcano is installed](https://github.com/kognise/volcano#installation)
2. Copy `andy-matuschak.js` to `~/volcano/plugins` (`%USERPROFILE%\volcano\plugins` on Windows)
3. Restart Obsidian and watch the magic happen

## Settings
There are two settings for heading width (the width of the rotated header) and the leaf width (the width of a single markdown page).  
I haven't quite figured out how to get them to update when you edit them so any changes will currently require a reload to be seen.

## Notes
This is all very expermental at the moment, so parts might not work, etc.  
It still gets a bit slow if you're loading a lot of documents, so try not to load too many at once.
