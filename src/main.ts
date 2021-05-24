import './styles.scss'
import { FileView, Plugin, TAbstractFile, WorkspaceLeaf, WorkspaceItem, WorkspaceSplit } from 'obsidian';
import { WorkspaceItemExt } from './obsidian-ext';
import { Editor, Position, Token } from 'codemirror';
import { SlidingPanesSettings, SlidingPanesSettingTab, SlidingPanesCommands, Orientation } from './settings';


export default class SlidingPanesPlugin extends Plugin {
  settings: SlidingPanesSettings;

  // helper variables
  private activeLeafIndex: number = 0;

  // helper gets for any casts (for undocumented API stuff)
  private get rootSplit(): WorkspaceSplit { return this.app.workspace.rootSplit; }
  private get rootSplitAny(): any { return this.rootSplit as any; }
  private get rootContainerEl(): HTMLElement { return (this.app.workspace.rootSplit as WorkspaceItem as WorkspaceItemExt).containerEl; }
  private get rootLeaves(): WorkspaceLeaf[] {
    const rootContainerEl = this.rootContainerEl;
    let rootLeaves: WorkspaceLeaf[] = [];
    this.app.workspace.iterateRootLeaves((leaf: any) => {
      if (leaf.containerEl.parentElement === rootContainerEl) {
        rootLeaves.push(leaf);
      }
    })
    return rootLeaves;
  }
  private prevRootLeaves: WorkspaceLeaf[] = [];

  // when the plugin is loaded
  async onload() {
    // load settings
    this.settings = Object.assign(new SlidingPanesSettings(), await this.loadData());

    // if it's not disabled in the settings, enable it
    if (!this.settings.disabled) this.enable();

    // add the settings tab
    this.addSettingTab(new SlidingPanesSettingTab(this.app, this));
    // add the commands
    new SlidingPanesCommands(this).addCommands();
  }

  // on unload, perform the same steps as disable
  onunload() {
    this.disable();
  }

  // enable andy mode
  enable = () => {
    // add the event handlers
    this.registerEvent(this.app.workspace.on('resize', this.handleResize));
    this.registerEvent(this.app.workspace.on('layout-change', this.handleLayoutChange));
    this.registerEvent(this.app.workspace.on('file-open', this.handleFileOpen));
    this.registerEvent(this.app.vault.on('delete', this.handleDelete));

    // wait for layout to be ready to perform the rest
    this.app.workspace.layoutReady ? this.reallyEnable() : this.app.workspace.on('layout-ready', this.reallyEnable);
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
    this.rootLeaves.forEach(this.clearLeaf);

    // restore the default functionality
    this.rootSplitAny.onChildResizeStart = this.rootSplitAny.oldOnChildResizeStart;
  }

  clearLeaf = (leaf: any) => {
    leaf.containerEl.style.width = null;
    leaf.containerEl.style.left = null;
    leaf.containerEl.style.right = null;
    leaf.containerEl.classList.remove('mod-am-left-of-active');
    leaf.containerEl.classList.remove('mod-am-right-of-active');

    const iconEl = (leaf.view as any).iconEl;
    const iconText:string = iconEl.getAttribute("aria-label");
    if (iconText.includes("(")) {
      iconEl.setAttribute("aria-label", iconText.substring(iconText.lastIndexOf('(') + 1, iconText.lastIndexOf(')')));
    }
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
      el.innerText = `body.plugin-sliding-panes{--header-width:${this.settings.headerWidth}px;}`;
      if (!this.settings.leafAutoWidth) {
        el.innerText += `body.plugin-sliding-panes .mod-root>.workspace-leaf{width:${this.settings.leafWidth + this.settings.headerWidth}px;}`;
      }
    }
    
    if (this.settings.rotateHeaders){
      this.selectOrientation(this.settings.orienation);
    }
  }

  selectOrientation(orient: Orientation) {
    document.body.classList.toggle('plugin-sliding-select-orientation-mixed', orient == 'mixed');
    document.body.classList.toggle('plugin-sliding-select-orientation-upright', orient == 'upright');
    document.body.classList.toggle('plugin-sliding-select-orientation-sideway', orient == 'sideway');
  }

  handleResize = () => {
    if (this.app.workspace.layoutReady) {
      this.recalculateLeaves();
    }
  }

  handleLayoutChange = () => {
    const rootLeaves = this.rootLeaves;
    if (rootLeaves.length < this.prevRootLeaves.length) {
      this.prevRootLeaves.forEach((leaf: any) => {
        if (!rootLeaves.contains(leaf)) {
          this.clearLeaf(leaf);
        }
      })
    }
    this.prevRootLeaves = this.rootLeaves;
    //this.recalculateLeaves();
  }

  // Recalculate the leaf sizing and positions
  recalculateLeaves = () => {
    // rootSplit.children is undocumented for now, but it's easier to use for what we're doing.
    // we only want leaves at the root of the root split
    // (this is to fix compatibility with backlinks in document and other such plugins)
    const rootContainerEl = this.rootContainerEl;
    const rootLeaves = this.rootLeaves;
    const leafCount = rootLeaves.length;

    let totalWidth = 0;

    // iterate through all the root-level leaves
    let widthChange = false;
    rootLeaves.forEach((leaf: WorkspaceLeaf, i: number) => {

      // @ts-ignore to get the undocumented containerEl
      const containerEl = leaf.containerEl;

      containerEl.style.flex = null;
      const oldWidth = containerEl.clientWidth;
      if (this.settings.leafAutoWidth) {
        containerEl.style.width = (rootContainerEl.clientWidth - ((leafCount - 1) * this.settings.headerWidth)) + "px";
      }
      else {
        containerEl.style.width = null;
      }
      if (oldWidth == containerEl.clientWidth) widthChange = true;

      containerEl.style.left = this.settings.stackingEnabled
        ? (i * this.settings.headerWidth) + "px"
        : null;
      containerEl.style.right = this.settings.stackingEnabled
        ? (((leafCount - i) * this.settings.headerWidth) - containerEl.clientWidth) + "px"
        : null;
      // keep track of the total width of all leaves
      totalWidth += containerEl.clientWidth;

      const iconEl = (leaf.view as any).iconEl;
      const iconText = iconEl.getAttribute("aria-label");
      if (!iconText.includes("(")) {
        iconEl.setAttribute("aria-label", `${leaf.getDisplayText()} (${iconText})`);
      }
    });

    // if the total width of all leaves is less than the width available,
    // add back the flex class so they fill the space
    if (totalWidth < rootContainerEl.clientWidth) {
      rootLeaves.forEach((leaf: any) => {
        leaf.containerEl.style.flex = '1 0 0';
      });
    }

    if(widthChange) this.focusActiveLeaf(!this.settings.leafAutoWidth);
  }

  // this function is called, not only when a file opens, but when the active pane is switched
  handleFileOpen = (e: any): void => {
    // put a small timeout on it because when a file is opened on the far right 
    // it wasn't focussing properly. The timeout fixes this
    setTimeout(() => {
      // focus on the newly selected leaf
      this.focusActiveLeaf();
    }, 10);
  };

  focusActiveLeaf(animated: boolean = true) {
    // get back to the leaf which has been andy'd (`any` because parentSplit is undocumented)
    let activeLeaf: WorkspaceItemExt = this.app.workspace.activeLeaf as WorkspaceItem as WorkspaceItemExt;
    while (activeLeaf != null && activeLeaf.parentSplit != null && activeLeaf.parentSplit != this.app.workspace.rootSplit) {
      activeLeaf = activeLeaf.parentSplit as WorkspaceItemExt;
    }
    
    if (activeLeaf != null && this.rootSplit) {

      const rootContainerEl = this.rootContainerEl;
      const rootLeaves = this.rootLeaves;
      const leafCount = rootLeaves.length;

      // get the index of the active leaf
      // also, get the position of this leaf, so we can scroll to it
      // as leaves are resizable, we have to iterate through all leaves to the
      // left until we get to the active one and add all their widths together
      let position = 0;
      this.activeLeafIndex = -1;
      rootLeaves.forEach((leaf: WorkspaceItem, index: number) => {
        // @ts-ignore to get the undocumented containerEl
        const containerEl = leaf.containerEl;

        // this is the active one
        if (leaf == activeLeaf) {
          this.activeLeafIndex = index;
          containerEl.classList.remove('mod-am-left-of-active');
          containerEl.classList.remove('mod-am-right-of-active');
        }
        else if(this.activeLeafIndex == -1 || index < this.activeLeafIndex) {
          // this is before the active one, add the width
          position += containerEl.clientWidth;
          containerEl.classList.add('mod-am-left-of-active');
          containerEl.classList.remove('mod-am-right-of-active');
        }
        else {
          // this is right of the active one
          containerEl.classList.remove('mod-am-left-of-active');
          containerEl.classList.add('mod-am-right-of-active');
        }
      });
      
      // get this leaf's left value (the amount of space to the left for sticky headers)
      const left = parseInt(activeLeaf.containerEl.style.left) || 0;
      // the amount of space to the right we need to leave for sticky headers
      const headersToRightWidth = this.settings.stackingEnabled ? (leafCount - this.activeLeafIndex - 1) * this.settings.headerWidth : 0;

      // determine whether to request 'smooth' animations or 'auto' snap
      let behavior: ScrollBehavior = animated && this.settings.smoothAnimation ? 'smooth' : 'auto';

      // it's too far left
      if (rootContainerEl.scrollLeft > position - left) {
        // scroll the left side of the pane into view
        rootContainerEl.scrollTo({ left: position - left, top: 0, behavior: behavior });
      }
      // it's too far right
      else if (rootContainerEl.scrollLeft + rootContainerEl.clientWidth < position + activeLeaf.containerEl.clientWidth + headersToRightWidth) {
        // scroll the right side of the pane into view
        rootContainerEl.scrollTo({ left: position + activeLeaf.containerEl.clientWidth + headersToRightWidth - rootContainerEl.clientWidth, top: 0, behavior: behavior });
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
          const rootLeaves = this.rootLeaves;
          const leafCount = rootLeaves.length;
          const leafIndex = rootLeaves.findIndex((l: any) => l == leaf);
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
