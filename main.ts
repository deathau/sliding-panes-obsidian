import './styles.scss'
import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

export default class SlidingPanesPlugin extends Plugin {
  settings: SlidingPanesSettings;

  private leavesOpenCount: number = 0;
  private activeLeafIndex: number = 0;

  async onInit() {

  }

  async onload() {
    this.settings = await this.loadData() || new SlidingPanesSettings();

    if (!this.settings.disabled) {
      this.enable();
    }
    this.addSettingTab(new SlidingPanesSettingTab(this.app, this));
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
    if ((this.app.workspace as any).layoutReady) {
      this.layoutReady();
    }
    else {
      this.app.workspace.on('layout-ready', this.layoutReady);
    }
    this.app.workspace.on('resize', this.recalculateLeaves);
    this.app.workspace.on('file-open', this.handleFileOpen);
  }

  disable = () => {
    this.removeStyle();
    const workspaceEl = (this.app.workspace as any).rootSplit.containerEl;
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
    this.app.workspace.off('file-open', this.handleFileOpen);
  }

  layoutReady = () => {
    (this.app.workspace as any).rootSplit.containerEl.style.overflowX = "auto";

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
    const el = document.getElementById('plugin-sliding-panes');
    if (el) el.remove();
    document.body.classList.remove('plugin-sliding-panes');
  }

  addStyle = () => {
    const css = document.createElement('style');
    css.id = 'plugin-sliding-panes';
    css.appendChild(document.createTextNode(`
      body.plugin-sliding-panes{--header-width:${this.settings.headerWidth}px;}
    `));

    document.getElementsByTagName("head")[0].appendChild(css);
    document.body.classList.add('plugin-sliding-panes');
  }

  recalculateLeaves = () => {
    const workspaceEl = (this.app.workspace as any).rootSplit.containerEl;
    const leaves = workspaceEl.querySelectorAll(":scope>div");
    const leafCount = leaves.length;
    leaves.forEach((leaf:any, i:number) => {
      leaf.style.minWidth = (this.settings.leafWidth + this.settings.headerWidth) + "px";
      leaf.style.boxShadow = "0px 0px 20px 20px rgba(0,0,0,0.25)";
      leaf.style.position = "sticky";
      leaf.style.left = (i * this.settings.headerWidth) + "px";
      leaf.style.right = (((leafCount - i - 1) * this.settings.headerWidth) - this.settings.leafWidth) + "px";

      leaf.dataset.slidingPanesIndex = i;
      leaf.dataset.slidingPanesCount = leafCount;
    });
  }

  handleFileOpen = (e: any): void => {
    this.activateAdjacentLeafIfClosed(e);
    this.focusLeaf(e);
  };

  activateAdjacentLeafIfClosed = (e: any): void => {
    const workspaceEl = (this.app.workspace.rootSplit as any).containerEl;
    const leaves = workspaceEl.querySelectorAll(":scope>div");
    const leafCount = leaves.length;

    if (leafCount < this.leavesOpenCount) {
      let isActiveLeafSet: boolean = false;
      this.app.workspace.iterateRootLeaves((leaf: any) => {
        const index = parseInt(leaf.containerEl.dataset.slidingPanesIndex);
        if (!isActiveLeafSet && (index === this.activeLeafIndex - 1 || index == this.activeLeafIndex + 1)) {
          (this.app.workspace as any).setActiveLeaf(leaf);
          isActiveLeafSet = true;
        }
      })
    }

    this.leavesOpenCount = leafCount;
    this.recalculateLeaves();
    this.activeLeafIndex = parseInt((this.app.workspace.activeLeaf as any).containerEl.dataset.slidingPanesIndex);
  }

  focusLeaf = (e: any) => {
    const rootSplit: any = (this.app.workspace as any).rootSplit;
    // get back to the leaf which has been andy'd
    let leaf:any = this.app.workspace.activeLeaf;
    while (leaf != null && leaf.parentSplit != null && leaf.parentSplit != rootSplit) {
      leaf = leaf.parentSplit;
    }

    if (leaf != null) {
      // figure out which "number" leaf this is, and where we need to scroll to
      const left = parseInt(leaf.containerEl.style.left);
      const leafNumber = left / this.settings.headerWidth;
      const position = (leafNumber * this.settings.leafWidth) + left;

      const rootEl = rootSplit.containerEl;
      if (rootEl.scrollLeft < position || rootEl.scrollLeft + rootEl.clientWidth > position + leaf.containerEl.clientWidth) {
        rootEl.scrollTo({ left: position - left, top: 0, behavior: 'smooth' });
      }
    }
  }
}

class SlidingPanesSettings {
  headerWidth: number = 32;
  leafWidth: number = 700;
  disabled: boolean = false;
}

class SlidingPanesSettingTab extends PluginSettingTab {

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
      .setName('Header Width')
      .setDesc('The width of the rotated header')
      .addText(text => text.setPlaceholder('Example: 32')
        .setValue((this.plugin.settings.headerWidth || '') + '')
        .onChange((value) => {
          console.log('Header Width: ' + value);
          this.plugin.settings.headerWidth = parseInt(value.trim());
          this.plugin.saveData(this.plugin.settings);
          this.plugin.refresh();
        }));
    
    new Setting(containerEl)
      .setName('Leaf Width')
      .setDesc('The width of a single markdown pane')
      .addText(text => text.setPlaceholder('Example: 700')
        .setValue((this.plugin.settings.leafWidth || '') + '')
        .onChange((value) => {
          console.log('Leaf Width: ' + value);
          this.plugin.settings.leafWidth = parseInt(value.trim());
          this.plugin.saveData(this.plugin.settings);
          this.plugin.refresh();
        }));

  }
}
