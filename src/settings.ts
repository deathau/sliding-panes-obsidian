import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

declare class SlidingPanesPlugin extends Plugin {
  settings: SlidingPanesSettings;
  disable(): void;
  enable(): void;
  refresh(): void;
}

export class SlidingPanesSettings {
  headerWidth: number = 32;
  leafWidth: number = 700;
  leafAutoWidth: boolean = false;
  disabled: boolean = false;
  rotateHeaders: boolean = true;
  headerAlt: boolean = false;
  stackingEnabled: boolean = true;
  horizontalMode: boolean = false;
}

export class SlidingPanesSettingTab extends PluginSettingTab {

  plugin: SlidingPanesPlugin;
  constructor(app: App, plugin: SlidingPanesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("Toggle Sliding Panes")
      .setDesc("Turns sliding panes on or off globally")
      .addToggle(toggle => toggle.setValue(!this.plugin.settings.disabled)
        .onChange((value) => {
          this.plugin.settings.disabled = !value;
          this.plugin.saveData(this.plugin.settings);
          if (this.plugin.settings.disabled) {
            this.plugin.disable();
          }
          else {
            this.plugin.enable();
          }
        }));

    new Setting(containerEl)
      .setName('Leaf Auto Width')
      .setDesc('If on, the width of the pane should fill the available space')
      .addToggle(toggle => toggle.setValue(this.plugin.settings.leafAutoWidth)
        .onChange((value) => {
          this.plugin.settings.leafAutoWidth = value;
          this.plugin.saveData(this.plugin.settings);
          this.plugin.refresh();
        }));

    new Setting(containerEl)
      .setName('Leaf Width')
      .setDesc('The width of a single pane (only if auto width is off)')
      .addText(text => text.setPlaceholder('Example: 700')
        .setValue((this.plugin.settings.leafWidth || '') + '')
        .onChange((value) => {
          this.plugin.settings.leafWidth = parseInt(value.trim());
          this.plugin.saveData(this.plugin.settings);
          this.plugin.refresh();
        }));

    new Setting(containerEl)
      .setName("Toggle rotated headers")
      .setDesc("Rotates headers to use as spines")
      .addToggle(toggle => toggle.setValue(this.plugin.settings.rotateHeaders)
        .onChange((value) => {
          this.plugin.settings.rotateHeaders = value;
          this.plugin.saveData(this.plugin.settings);
          this.plugin.refresh();
        }));

    new Setting(containerEl)
      .setName("Swap rotated header direction")
      .setDesc("Swaps the direction of rotated headers")
      .addToggle(toggle => toggle.setValue(this.plugin.settings.headerAlt)
        .onChange((value) => {
          this.plugin.settings.headerAlt = value;
          this.plugin.saveData(this.plugin.settings);
          this.plugin.refresh();
        }));

    new Setting(containerEl)
      .setName("Toggle stacking")
      .setDesc("Panes will stack up to the left and right")
      .addToggle(toggle => toggle.setValue(this.plugin.settings.stackingEnabled)
        .onChange((value) => {
          this.plugin.settings.stackingEnabled = value;
          this.plugin.saveData(this.plugin.settings);
          this.plugin.refresh();
        }));

    new Setting(containerEl)
      .setName('Spine Width')
      .setDesc('The width of the rotated header (or gap) for stacking')
      .addText(text => text.setPlaceholder('Example: 32')
        .setValue((this.plugin.settings.headerWidth || '') + '')
        .onChange((value) => {
          this.plugin.settings.headerWidth = parseInt(value.trim());
          this.plugin.saveData(this.plugin.settings);
          this.plugin.refresh();
        }));
    
    new Setting(containerEl)
      .setName('Horizontal Mode')
      .setDesc('Scroll up and down, instead of left and right')
      .addToggle(toggle => toggle.setValue(this.plugin.settings.horizontalMode)
        .onChange((value) => {
          this.plugin.settings.horizontalMode = value;
          this.plugin.saveData(this.plugin.settings);
          this.plugin.refresh();
        }));
  }
}

export class SlidingPanesCommands {
  plugin: SlidingPanesPlugin;
  constructor(plugin: SlidingPanesPlugin) {
    this.plugin = plugin;
  }

  addToggleSettingCommand(id:string, name:string, settingName:string) {
    this.plugin.addCommand({
      id: id,
      name: name,
      callback: () => {
        // switch the setting, save and refresh
        //@ts-ignore
        this.plugin.settings[settingName] = !this.plugin.settings[settingName];
        this.plugin.saveData(this.plugin.settings);
        this.plugin.refresh();
      }
    });
  }

  addCommands(): void {
    // add the toggle on/off command
    this.plugin.addCommand({
      id: 'toggle-sliding-panes',
      name: 'Toggle Sliding Panes',
      callback: () => {
        // switch the disabled setting and save
        this.plugin.settings.disabled = !this.plugin.settings.disabled;
        this.plugin.saveData(this.plugin.settings);

        // disable or enable as necessary
        this.plugin.settings.disabled ? this.plugin.disable() : this.plugin.enable();
      }
    });

    // add a command to toggle leaf auto width
    this.addToggleSettingCommand('toggle-sliding-panes-leaf-auto-width', 'Toggle Leaf Auto Width', 'leafAutoWidth');
    
    // add a command to toggle stacking
    this.addToggleSettingCommand('toggle-sliding-panes-stacking', 'Toggle Stacking', 'stackingEnabled');

    // add a command to toggle rotated headers
    this.addToggleSettingCommand('toggle-sliding-panes-rotated-headers', 'Toggle Rotated Headers', 'rotateHeaders');

    // add a command to toggle swapped header direction
    this.addToggleSettingCommand('toggle-sliding-panes-header-alt', 'Swap rotated header direction', 'headerAlt');

    this.addToggleSettingCommand('toggle-sliding-panes-horizontal-mode', 'Toggle horizontal mode', 'horizontalMode');
  }
}