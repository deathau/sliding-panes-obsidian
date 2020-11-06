import './styles.scss'
import { App, FileView, Plugin, PluginSettingTab, Setting, TAbstractFile, WorkspaceLeaf } from 'obsidian';
import { Editor, Position, Token } from 'codemirror';

export default class SlidingPanesPlugin extends Plugin {
  settings: SlidingPanesSettings;

  private leavesOpenCount: number = 0;
  private activeLeafIndex: number = 0;
  private suggestionContainerObserver: MutationObserver;

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

    // observe the app-container for when the suggestion-container appears
    this.suggestionContainerObserver = new MutationObserver((mutations: MutationRecord[]): void => {
      mutations.forEach((mutation: MutationRecord): void => {
        mutation.addedNodes.forEach((node: any): void => {
          if (node.className === 'suggestion-container') {
            this.positionSuggestionContainer(node);
          }
        });
      });
    });
    const observerTarget: Node = (this.app as any).dom.appContainerEl;
    const observerConfig: MutationObserverInit = { childList: true }
    this.suggestionContainerObserver.observe(observerTarget, observerConfig);
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
    this.app.vault.on('delete', this.handleDelete);
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
    this.app.vault.off('delete', this.handleDelete);
    this.suggestionContainerObserver.disconnect();
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
    document.body.classList.remove('plugin-sliding-panes-rotate-header');
  }

  addStyle = () => {
    const css = document.createElement('style');
    css.id = 'plugin-sliding-panes';
    css.appendChild(document.createTextNode(`
      body.plugin-sliding-panes{--header-width:${this.settings.headerWidth}px;}
    `));

    document.getElementsByTagName("head")[0].appendChild(css);
    document.body.classList.add('plugin-sliding-panes');
    if (this.settings.rotateHeaders)
      document.body.classList.add('plugin-sliding-panes-rotate-header');
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

      // for use in focusLeaf (and activateAdjacentLeafIfClosed)
      leaf.dataset.index = i;
      leaf.dataset.total = leafCount;
    });
  }

  handleFileOpen = (e: any): void => {
    // put a small timeout on it because when a file is opened on the far right 
    // it wasn't focussing properly. The timeout fixes this
    setTimeout(() => {
      this.activateAdjacentLeafIfClosed(e);
      this.focusLeaf(e)
    }, 10);
  };

  activateAdjacentLeafIfClosed = (e: any): void => {
    const workspaceEl = (this.app.workspace.rootSplit as any).containerEl;
    const leaves = workspaceEl.querySelectorAll(":scope>div");
    const leafCount = leaves.length;

    if (leafCount < this.leavesOpenCount) {
      let isActiveLeafSet: boolean = false;
      this.app.workspace.iterateRootLeaves((leaf: any) => {
        const index = parseInt(leaf.containerEl.dataset.index);
        if (!isActiveLeafSet && (index === this.activeLeafIndex - 1 || index == this.activeLeafIndex + 1)) {
          (this.app.workspace as any).setActiveLeaf(leaf);
          isActiveLeafSet = true;
        }
      })
    }

    this.leavesOpenCount = leafCount;
    this.recalculateLeaves();
    this.activeLeafIndex = parseInt((this.app.workspace.activeLeaf as any).containerEl.dataset.index);
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
      const leafNumber = leaf.containerEl.dataset.index;
      const leafCount = leaf.containerEl.dataset.total;
      const position = (leafNumber * this.settings.leafWidth) + left;

      const rootEl = rootSplit.containerEl;
      const headersToRightWidth = (leafCount - leafNumber - 1) * this.settings.headerWidth;
      if (rootEl.scrollLeft > position) { // it's too far left
        rootEl.scrollTo({ left: position - left, top: 0, behavior: 'smooth' });
      } else if (rootEl.scrollLeft + rootEl.clientWidth < position + leaf.containerEl.clientWidth + headersToRightWidth) { // it's too far right
        const numVisibleLeaves = (rootEl.clientWidth - (leafCount * this.settings.headerWidth)) / this.settings.leafWidth;
        const otherVisibleLeavesWidth = this.settings.leafWidth * Math.max(0, numVisibleLeaves - 1);
        const headersToLeftWidth = this.settings.headerWidth * leafNumber;

        rootEl.scrollTo({ left: position - otherVisibleLeavesWidth - headersToLeftWidth, top: 0, behavior: 'smooth' });
      }
    }
  }

  handleDelete = (file: TAbstractFile) => {
    // close any leaves with the deleted file open
    // detaching a leaf while iterating messes with the iteration
    const leavesToDetach: WorkspaceLeaf[] = [];
    this.app.workspace.iterateRootLeaves((leaf: WorkspaceLeaf) => {
      if (leaf.view instanceof FileView && leaf.view.file == file) {
        leavesToDetach.push(leaf);
      }
    });
    leavesToDetach.forEach(leaf => leaf.detach());
  };

  positionSuggestionContainer = (scNode: any): void => {
    const cmEditor = (this.app.workspace.activeLeaf.view as any).sourceMode.cmEditor as Editor;

    // find the open bracket to the left of or at the cursor

    const cursorPosition = cmEditor.getCursor();
    var currentToken = cmEditor.getTokenAt(cmEditor.getCursor());

    let currentLinkPosition: Position;

    if (currentToken.string === '[]') { // there is no text within the double brackets yet
      currentLinkPosition = cursorPosition;
    } else { // there is text within the double brackets
      var lineTokens = cmEditor.getLineTokens(cursorPosition.line);
      var previousTokens = lineTokens.filter((token: Token): boolean => token.start <= currentToken.start).reverse();
      const openBracketsToken = previousTokens.find((token: Token): boolean => token.string.contains('['));

      // position the suggestion container to just underneath the end of the open brackets
      currentLinkPosition = { line: cursorPosition.line, ch: openBracketsToken.end };
    }

    const scCoords = cmEditor.charCoords(currentLinkPosition);

    // make sure it fits within the window

    const appContainerEl = (this.app as any).dom.appContainerEl

    const scRight = scCoords.left + scNode.offsetWidth;
    const appWidth = appContainerEl.offsetWidth;
    if (scRight > appWidth) {
      scCoords.left -= scRight - appWidth;
    }

    // set the left coord
    // the top coord is set by Obsidian and is correct.
    // it's also a pain to try to recalculate so I left it out.

    scNode.style.left = Math.max(scCoords.left, 0) + 'px';
  };
}

class SlidingPanesSettings {
  headerWidth: number = 32;
  leafWidth: number = 700;
  disabled: boolean = false;
  rotateHeaders: boolean = true;
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
      .setName('Leaf Width')
      .setDesc('The width of a single pane')
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
      .setName('Spine Width')
      .setDesc('The width of the rotated header (or gap) for stacking')
      .addText(text => text.setPlaceholder('Example: 32')
        .setValue((this.plugin.settings.headerWidth || '') + '')
        .onChange((value) => {
          this.plugin.settings.headerWidth = parseInt(value.trim());
          this.plugin.saveData(this.plugin.settings);
          this.plugin.refresh();
        }));

  }
}
