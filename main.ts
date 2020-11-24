import './styles.scss'
import { App, FileView, Plugin, PluginSettingTab, Setting, TAbstractFile, WorkspaceLeaf } from 'obsidian';
import { Editor, Position, Token } from 'codemirror';

export default class SlidingPanesPlugin extends Plugin {
  settings: SlidingPanesSettings;

  // helper variables
  private leavesOpenCount: number = 0;
  private activeLeafIndex: number = 0;
  private suggestionContainerObserver: MutationObserver;

  // helper gets for any casts (for undocumented API stuff)
  private get rootSplitAny(): any { return this.app.workspace.rootSplit; }

  // when the plugin is loaded
  async onload() {
    // load settings
    this.settings = await this.loadData() || new SlidingPanesSettings();

    // if it's not disabled in the settings, enable it
    if (!this.settings.disabled) {
      this.enable();
    }

    // add the settings tab
    this.addSettingTab(new SlidingPanesSettingTab(this.app, this));
    // add the toggle on/off command
    this.addCommand({
      id: 'toggle-sliding-panes',
      name: 'Toggle Sliding Panes',
      callback: () => {
        // switch the disabled setting and save
        this.settings.disabled = !this.settings.disabled;
        this.saveData(this.settings);

        // disable or enable as necessary
        this.settings.disabled ? this.disable() : this.enable();
      }
    });

    // add a command to toggle stacking
    this.addCommand({
      id: 'toggle-sliding-panes-stacking',
      name: 'Toggle Stacking',
      callback: () => {
        // switch the setting, save and refresh
        this.settings.stackingEnabled = !this.settings.stackingEnabled;
        this.saveData(this.settings);
        this.refresh();
      }
    });

    // add a command to toggle rotated headers
    this.addCommand({
      id: 'toggle-sliding-panes-rotated-headers',
      name: 'Toggle Rotated Headers',
      callback: () => {
        // switch the setting, save and refresh
        this.settings.rotateHeaders = !this.settings.rotateHeaders;
        this.saveData(this.settings);
        this.refresh();
      }
    });

    // add a command to toggle swapped header direction
    this.addCommand({
      id: 'toggle-sliding-panes-header-alt',
      name: 'Swap rotated header direction',
      callback: () => {
        // switch the setting, save and refresh
        this.settings.headerAlt = !this.settings.headerAlt;
        this.saveData(this.settings);
        this.refresh();
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

  // on unload, perform the same steps as disable
  onunload() {
    this.disable();
  }

  // enable andy mode
  enable = () => {
    // add the event handlers
    this.app.workspace.on('resize', this.refresh);
    this.app.workspace.on('file-open', this.handleFileOpen);
    this.app.vault.on('delete', this.handleDelete);

    // wait for layout to be ready to perform the rest
    (this.app.workspace as any).layoutReady ? this.reallyEnable() : this.app.workspace.on('layout-ready', this.reallyEnable);
  }

  // really enable things (once the layout is ready)
  reallyEnable = () => {
    // we don't need the event handler anymore
    this.app.workspace.off('layout-ready', this.reallyEnable);

    // backup the function so I can restore it
    this.rootSplitAny.oldOnChildResizeStart = this.rootSplitAny.onChildResizeStart;
    this.rootSplitAny.onChildResizeStart = this.onChildResizeStart;

    // add some extra classes that can't fit in the styles.css
    // because they use settings
    this.addStyle();

    // do all the calucations necessary for the workspace leaves
    this.recalculateLeaves();
  }

  // shut down andy mode
  disable = () => {

    // get rid of the extra style tag we added
    this.removeStyle();

    // iterate through the root leaves to remove the stuff we added
    this.app.workspace.iterateRootLeaves((leaf: any) => {
      leaf.containerEl.style.width = null;
      leaf.containerEl.style.left = null;
      leaf.containerEl.style.right = null;
    });

    // restore the default functionality
    this.rootSplitAny.onChildResizeStart = this.rootSplitAny.oldOnChildResizeStart;

    // get rid of our event handlers
    this.app.workspace.off('resize', this.recalculateLeaves);
    this.app.workspace.off('file-open', this.handleFileOpen);
    this.app.vault.off('delete', this.handleDelete);
    this.suggestionContainerObserver.disconnect();
  }

  // refresh funcion for when we change settings
  refresh = () => {
    // re-load the style
    this.updateStyle()
    // recalculate leaf positions
    this.recalculateLeaves();
  }

  // remove the stlying elements we've created
  removeStyle = () => {
    const el = document.getElementById('plugin-sliding-panes');
    if (el) el.remove();
    document.body.classList.remove('plugin-sliding-panes');
    document.body.classList.remove('plugin-sliding-panes-rotate-header');
    document.body.classList.remove('plugin-sliding-panes-header-alt');
    document.body.classList.remove('plugin-sliding-panes-stacking');
  }

  // add the styling elements we need
  addStyle = () => {
    // add a css block for our settings-dependent styles
    const css = document.createElement('style');
    css.id = 'plugin-sliding-panes';
    document.getElementsByTagName("head")[0].appendChild(css);

    // add the main class
    document.body.classList.add('plugin-sliding-panes');

    // update the style with the settings-dependent styles
    this.updateStyle();
  }

  // update the styles (at the start, or as the result of a settings change)
  updateStyle = () => {
    // if we've got rotate headers on, add the class which enables it
    document.body.classList.toggle('plugin-sliding-panes-rotate-header', this.settings.rotateHeaders);
    document.body.classList.toggle('plugin-sliding-panes-header-alt', this.settings.headerAlt)
    // do the same for stacking
    document.body.classList.toggle('plugin-sliding-panes-stacking', this.settings.stackingEnabled);
    
    // get the custom css element
    const el = document.getElementById('plugin-sliding-panes');
    if (!el) throw "plugin-sliding-panes element not found!";
    else {
      // set the settings-dependent css
      el.innerText = `
        body.plugin-sliding-panes{--header-width:${this.settings.headerWidth}px;}
        body.plugin-sliding-panes .mod-root>.workspace-leaf{
          width:${this.settings.leafWidth + this.settings.headerWidth}px;
        }
      `;
    }
  }

  // Recalculate the leaf sizing and positions
  recalculateLeaves = () => {
    // rootSplit.children is undocumented for now, but it's easier to use for what we're doing.
    const leafCount = this.rootSplitAny.children.length;
    let totalWidth = 0;

    // iterate through all the root-level leaves
    // keep the leaf as `any` to get the undocumented containerEl
    this.rootSplitAny.children.forEach((leaf: any, i: number) => {
      leaf.containerEl.style.left = this.settings.stackingEnabled
        ? (i * this.settings.headerWidth) + "px"
        : null;
      leaf.containerEl.style.right = this.settings.stackingEnabled
        ? (((leafCount - i) * this.settings.headerWidth) - leaf.containerEl.clientWidth) + "px"
        : null;
      leaf.containerEl.style.flex = null;
      // keep track of the total width of all leaves
      totalWidth += leaf.containerEl.clientWidth;
    });

    // if the total width of all leaves is less than the width available,
    // add back the flex class so they fill the space
    if (totalWidth < this.rootSplitAny.containerEl.clientWidth) {
      this.rootSplitAny.children.forEach((leaf: any) => {
        leaf.containerEl.style.flex = '1 0 0';
      });
    }
  }

  // this function is called, not only when a file opens, but when the active pane is switched
  handleFileOpen = (e: any): void => {
    // put a small timeout on it because when a file is opened on the far right 
    // it wasn't focussing properly. The timeout fixes this
    setTimeout(() => {
      // check for a closed leaf and activate the adjacent leaf if it was
      this.activateAdjacentLeafIfClosed(e);
      // focus on the newly selected leaf
      this.focusLeaf(e)
    }, 10);
  };

  // check for a closed leaf and activate the adjacent leaf
  activateAdjacentLeafIfClosed = async (e: any) => {
    // check that rootSplitAny is a thing first
    // (it might not be if the workspace is reloading?)
    if (this.rootSplitAny) {
      // first we need to figure out the count of open leaves
      const leafCount = this.rootSplitAny.children.length;

      // use this value to check if we've set an active leaf yet
      let isActiveLeafSet: boolean = false;

      // if the number of open leaves has changed
      if (leafCount != this.leavesOpenCount) {
        // if the number of leaves is < our last saved value, we must have closed one (or more)
        if (leafCount < this.leavesOpenCount) {
          // iterate through the leaves
          this.rootSplitAny.children.forEach((leaf: WorkspaceLeaf, i: number) => {
            // if we haven't activated a leaf yet and this leaf is adjacent to the closed one
            if (!isActiveLeafSet && (i >= this.activeLeafIndex - 1)) {
              // set the active leaf (undocumented, hence `any`)
              (this.app.workspace as any).setActiveLeaf(leaf);
              isActiveLeafSet = true;
              // set the index for next time, also.
              this.activeLeafIndex = i;
            }
          });
        }

        // set the new open count
        this.leavesOpenCount = leafCount;

        // recalculate leaf positions
        this.recalculateLeaves();
      }
    }
  }

  focusLeaf = (file: TAbstractFile) => {
    // get back to the leaf which has been andy'd (`any` because parentSplit is undocumented)
    let activeLeaf: any = this.app.workspace.activeLeaf;
    while (activeLeaf != null && activeLeaf.parentSplit != null && activeLeaf.parentSplit != this.app.workspace.rootSplit) {
      activeLeaf = activeLeaf.parentSplit;
    }
    
    if (activeLeaf != null && this.rootSplitAny) {
      // get the index of the active leaf
      // also, get the position of this leaf, so we can scroll to it
      // as leaves are resizable, we have to iterate through all leaves to the
      // left until we get to the active one and add all their widths together
      let position = 0;
      this.activeLeafIndex = -1;
      this.rootSplitAny.children.forEach((leaf: any, index:number) => {
        // this is the active one
        if (leaf == activeLeaf) {
          this.activeLeafIndex = index;
          leaf.containerEl.classList.remove('mod-am-left-of-active');
          leaf.containerEl.classList.remove('mod-am-right-of-active');
        }
        else if(this.activeLeafIndex == -1 || index < this.activeLeafIndex) {
          // this is before the active one, add the width
          position += leaf.containerEl.clientWidth;
          leaf.containerEl.classList.add('mod-am-left-of-active');
          leaf.containerEl.classList.remove('mod-am-right-of-active');
        }
        else {
          // this is right of the active one
          leaf.containerEl.classList.remove('mod-am-left-of-active');
          leaf.containerEl.classList.add('mod-am-right-of-active');
        }
      });
      
      // get the total leaf count
      const leafCount = this.rootSplitAny.children.length;
      // get this leaf's left value (the amount of space to the left for sticky headers)
      const left = parseInt(activeLeaf.containerEl.style.left) || 0;
      // the amount of space to the right we need to leave for sticky headers
      const headersToRightWidth = this.settings.stackingEnabled ? (leafCount - this.activeLeafIndex - 1) * this.settings.headerWidth : 0;
      // the root element we need to scroll
      const rootEl = this.rootSplitAny.containerEl;
      
      // it's too far left
      if (rootEl.scrollLeft > position - left) {
        // scroll the left side of the pane into view
        rootEl.scrollTo({ left: position - left, top: 0, behavior: 'smooth' });
      }
      // it's too far right
      else if (rootEl.scrollLeft + rootEl.clientWidth < position + activeLeaf.containerEl.clientWidth + headersToRightWidth) {
        // scroll the right side of the pane into view
        rootEl.scrollTo({ left: position + activeLeaf.containerEl.clientWidth + headersToRightWidth - rootEl.clientWidth, top: 0, behavior: 'smooth' });
      }
    }
  }

  // hande when a file is deleted
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

  // position the suggestion container underneath the cursor for links and tags
  positionSuggestionContainer = (scNode: any): void => {
    const cmEditor = (this.app.workspace.activeLeaf.view as any).sourceMode.cmEditor as Editor;

    // find the open bracket or hashtag to the left of or at the cursor

    const cursorPosition = cmEditor.getCursor();
    var currentToken = cmEditor.getTokenAt(cmEditor.getCursor());

    let scCursorPosition: Position;

    // there's no text yet
    if (currentToken.string === '[]' || currentToken.string === '#') { 
      scCursorPosition = cursorPosition;
    } 
    // there is text
    else {
      // search the current line for the closest open bracket or a hashtag to the left
      var lineTokens = cmEditor.getLineTokens(cursorPosition.line);
      var previousTokens = lineTokens.filter((token: Token): boolean => token.start <= currentToken.start).reverse();
      const hashtagOrBracketsToken = previousTokens.find(
        (token: Token): boolean => token.string.contains('[') || token.string.contains('#')
      );

      if (hashtagOrBracketsToken) {
        // position the suggestion container to just underneath the end of the open brackets
        scCursorPosition = { line: cursorPosition.line, ch: hashtagOrBracketsToken.end };
      } else {
        // hashtagOrBracketsToken shouldn't be undefined, so this is just to be safe
        scCursorPosition = cursorPosition;
      }
    }

    const scCoords = cmEditor.charCoords(scCursorPosition);

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

  // overriden function for rootSplit child resize
  onChildResizeStart = (leaf: any, event: any) => {

    // only really apply this to vertical splits
    if (this.rootSplitAny.direction === "vertical") {
      // this is the width the leaf started at before resize
      const startWidth = leaf.containerEl.clientWidth;

      // the mousemove event to trigger while resizing
      const mousemove = (e: any) => {
        // get the difference between the first position and current
        const deltaX = e.pageX - event.pageX;
        // adjust the start width by the delta
        leaf.containerEl.style.width = `${startWidth + deltaX}px`;
      }

      // the mouseup event to trigger at the end of resizing
      const mouseup = () => {
        // if stacking is enabled, we need to re-jig the "right" value
        if (this.settings.stackingEnabled) {
          // we need the leaf count and index to calculate the correct value
          const leafCount = this.rootSplitAny.children.length;
          const leafIndex = this.rootSplitAny.children.findIndex((l: any) => l == leaf);
          leaf.containerEl.style.right = (((leafCount - leafIndex - 1) * this.settings.headerWidth) - leaf.containerEl.clientWidth) + "px";
        }

        // remove these event listeners. We're done with them
        document.removeEventListener("mousemove", mousemove);
        document.removeEventListener("mouseup", mouseup);
      }

      // Add the above two event listeners
      document.addEventListener("mousemove", mousemove);
      document.addEventListener("mouseup", mouseup);
    }
  }
}

class SlidingPanesSettings {
  headerWidth: number = 32;
  leafWidth: number = 700;
  disabled: boolean = false;
  rotateHeaders: boolean = true;
  headerAlt: boolean = false;
  stackingEnabled: boolean = true;
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

  }
}
