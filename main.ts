import { App, CustomPlugin, Modal, Notice, PluginSettingTab, Setting } from 'obsidian';

export default class AndyMatuschakPlugin extends CustomPlugin {

  settings: AndyMatuschakSettings;

  async onInit() {

  }

  async onload() {
    this.settings = await this.loadData();

    if (!this.settings.disabled) {
      this.enable();
    }
    this.addSettingTab(new AndyMatuschakSettingTab(this.app, this));
    this.addCommand({
      id: 'toggle-sliding-panes',
      name: 'Toggle Sliding Panes',
      callback: () => {
        this.settings.disabled = !this.settings.disabled;
        this.saveData(this.settings);
        if (this.settings.disabled) {
          this.disable();
        }
        else {
          this.enable();
        }
      }
    });
  }

  onunload() {
    this.disable();
  }

  enable = () => {
    if (this.app.workspace.layoutReady) {
      this.layoutReady();
    }
    else {
      this.app.workspace.on('layout-ready', this.layoutReady);
    }
    this.app.workspace.on('resize', this.recalculateLeaves);
    this.app.workspace.on('file-open', this.focusLeaf);
  }

  disable = () => {
    this.removeStyle();
    const workspaceEl = this.app.workspace.rootSplit.containerEl;
    workspaceEl.style.overflowX = null;
    const leaves = workspaceEl.querySelectorAll(":scope>div");
    leaves.forEach((leaf: any, i: number) => {
      leaf.style.minWidth = null;
      leaf.style.boxShadow = null;
      leaf.style.position = null;
      leaf.style.left = null;
      leaf.style.right = null;
    });

    this.app.workspace.off('resize', this.recalculateLeaves);
    this.app.workspace.off('file-open', this.focusLeaf);
  }

  layoutReady = () => {
    this.app.workspace.rootSplit.containerEl.style.overflowX = "auto";

    this.addStyle();

    this.app.workspace.off('layout-ready', this.layoutReady);
    this.recalculateLeaves();
  }

  refresh = () => {
    this.removeStyle();
    this.addStyle();
    this.recalculateLeaves();
  }

  removeStyle = () => {
    const el = document.getElementById('andy-matuschak-css');
    if (el) el.remove();
  }

  addStyle = () => {
    const css = document.createElement('style');
    css.type = 'text/css';
    css.id = 'andy-matuschak-css';
    if (this.settings.headerWidth) {
      css.appendChild(document.createTextNode(`
        .workspace-leaf-content{padding-left:${this.settings.headerWidth}px;}
        .view-header{width:${this.settings.headerWidth}px;}
      `));
    }

    document.getElementsByTagName("head")[0].appendChild(css);
  }

  recalculateLeaves = () => {
    const workspaceEl = this.app.workspace.rootSplit.containerEl;
    const leaves = workspaceEl.querySelectorAll(":scope>div");
    const leafCount = leaves.length;
    leaves.forEach((leaf:any, i:number) => {
      leaf.style.minWidth = (this.settings.leafWidth + this.settings.headerWidth) + "px";
      leaf.style.boxShadow = "0px 0px 20px 20px rgba(0,0,0,0.25)";
      leaf.style.position = "sticky";
      leaf.style.left = (i * this.settings.headerWidth) + "px";
      leaf.style.right = (((leafCount - i - 1) * this.settings.headerWidth) - this.settings.leafWidth) + "px";
    });
  }

  focusLeaf = (e: any) => {
    // get back to the leaf which has been andy'd
    let leaf:any = this.app.workspace.activeLeaf;
    while (leaf != null && leaf.parentSplit != null && leaf.parentSplit != this.app.workspace.rootSplit) {
      leaf = leaf.parentSplit;
    }

    if (leaf != null) {
      // figure out which "number" leaf this is, and where we need to scroll to
      const left = parseInt(leaf.containerEl.style.left);
      const leafNumber = left / this.settings.headerWidth;
      const position = (leafNumber * this.settings.leafWidth) + left;

      const rootEl = this.app.workspace.rootSplit.containerEl;
      if (rootEl.scrollLeft < position || rootEl.scrollLeft + rootEl.clientWidth > position + leaf.containerEl.clientWidth) {
        rootEl.scrollTo({ left: position - left, top: 0, behavior: 'smooth' });
      }
    }
  }
}

class AndyMatuschakSettings {
  headerWidth: number;
  leafWidth: number;
  disabled: boolean;
}

class AndyMatuschakSettingTab extends PluginSettingTab {
  display(): void {
    let { containerEl } = this;
    const plugin: any = this.plugin;

    containerEl.empty();

    new Setting(containerEl)
      .setName("Toggle Sliding Panes")
      .setDesc("Turns sliding panes on or off globally")
      .addToggle(toggle => toggle.setValue(!plugin.settings.disabled)
        .onChange((value) => {
          plugin.settings.disabled = !value;
          plugin.saveData(plugin.settings);
          if (plugin.settings.disabled) {
            plugin.disable();
          }
          else {
            plugin.enable();
          }
        }));

    new Setting(containerEl)
      .setName('Header Width')
      .setDesc('The width of the rotated header')
      .addText(text => text.setPlaceholder('Example: 32')
        .setValue((plugin.settings.headerWidth || '') + '')
        .onChange((value) => {
          console.log('Header Width: ' + value);
          plugin.settings.headerWidth = parseInt(value.trim());
          plugin.saveData(plugin.settings);
          plugin.refresh();
        }));
    
    new Setting(containerEl)
      .setName('Leaf Width')
      .setDesc('The width of a single markdown pane')
      .addText(text => text.setPlaceholder('Example: 700')
        .setValue((plugin.settings.leafWidth || '') + '')
        .onChange((value) => {
          console.log('Leaf Width: ' + value);
          plugin.settings.leafWidth = parseInt(value.trim());
          plugin.saveData(plugin.settings);
          plugin.refresh();
        }));

  }
}
