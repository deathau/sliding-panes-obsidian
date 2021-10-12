import './styles.scss'
import { FileView, Plugin, TAbstractFile, WorkspaceLeaf, WorkspaceItem, WorkspaceSplit } from 'obsidian';
import { WorkspaceLeafExt, WorkspaceSplitExt, WorkspaceItemExt } from './obsidian-ext';
import { Editor, Position, Token } from 'codemirror';
import { SlidingPanesSettings, SlidingPanesSettingTab } from './settings';
import { SlidingPanesCommands } from './commands';


export default class SlidingPanesPlugin extends Plugin {
  settings: SlidingPanesSettings;

  // helper gets for any casts (for undocumented API stuff)
  private get rootSplitAny(): any { return this.app.workspace.rootSplit as any; }

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
    this.app.workspace.onLayoutReady(this.reallyEnable);
  }

  // really enable things (once the layout is ready)
  reallyEnable = () => {

    // backup the function so I can restore it
    //this.rootSplitAny.oldOnChildResizeStart = this.rootSplitAny.onChildResizeStart;
    //this.rootSplitAny.onChildResizeStart = this.onChildResizeStart;

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
    this.app.workspace.iterateRootLeaves(this.clearLeaf);

    // restore the default functionality
    //this.rootSplitAny.onChildResizeStart = this.rootSplitAny.oldOnChildResizeStart;
  }

  clearLeaf = (leaf: any) => {
    leaf.containerEl.style.minWidth = null;
    leaf.containerEl.style.minHeight = null;
    leaf.containerEl.style.left = null;
    leaf.containerEl.style.right = null;
    leaf.containerEl.style.top = null;
    leaf.containerEl.style.bottom = null;
    leaf.containerEl.classList.remove('mod-am-left-of-active');
    leaf.containerEl.classList.remove('mod-am-right-of-active');
    leaf.containerEl.setAttribute('data-title', null)

    const iconEl = (leaf.view as any).iconEl;
    const iconText:string = iconEl.getAttribute("aria-label");
    if (iconText.includes("(")) {
      iconEl.setAttribute("aria-label", iconText.substring(iconText.lastIndexOf('(') + 1, iconText.lastIndexOf(')')));
    }
  }

  // refresh funcion for when we change settings
  refresh = () => {
    // re-load the style
    this.updateStyle();
    this.app.workspace.iterateRootLeaves(this.clearLeaf);
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
    document.body.classList.remove('plugin-sliding-panes-vertical-stacking');
    document.body.classList.remove('plugin-sliding-panes-horizontal-stacking');
    document.body.classList.remove('plugin-sliding-panes-horizontal-sliding');
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
    document.body.classList.toggle('plugin-sliding-panes-vertical-stacking', this.settings.stackingEnabled);

    document.body.classList.toggle('plugin-sliding-panes-horizontal-stacking', this.settings.horizontalStackingEnabled);
    document.body.classList.toggle('plugin-sliding-panes-horizontal-sliding', this.settings.horizontalSliding);
    
    // get the custom css element
    const el = document.getElementById('plugin-sliding-panes');
    if (!el) throw "plugin-sliding-panes element not found!";
    else {
      // set the settings-dependent css
      el.innerText = `body.plugin-sliding-panes{`;
      el.innerText += `--header-width:${this.settings.headerWidth}px;`
      if (!this.settings.leafAutoWidth) {
        el.innerText += `--leaf-width:${this.settings.leafWidth}px;`;
      }
      if (!this.settings.leafAutoHeight) {
        el.innerText += `--leaf-height:${this.settings.leafHeight}px;`;
      }
      el.innerText += `}`;
    }
  }

  handleResize = () => {
    // console.log('handle resize')
    // if (this.app.workspace.layoutReady) {
    //   this.recalculateLeaves();
    // }
  }

  handleLayoutChange = () => {

  }

  // Recalculate the leaf sizing and positions
  recalculateLeaves = (split: WorkspaceSplitExt = this.app.workspace.rootSplit as WorkspaceSplitExt) => {
    console.log("---recalculate leaves---", split)

    const leafCount = split.children.length;
    const splitWidth = split.containerEl.clientWidth;
    const splitHeight = split.containerEl.clientHeight;
    const stackedWidth = (splitWidth - ((leafCount - 1) * this.settings.headerWidth));
    const stackedHeight = (splitHeight - ((leafCount - 1) * this.settings.headerWidth));

    // let totalWidth = 0;
    // let totalHeight = 0;

    // iterate through all the leaves
    let widthChange = false;
    let heightChange = false;
    split.children.forEach((leaf: WorkspaceItemExt, i: number) => {

      const containerEl = leaf.containerEl;
      // containerEl.style.flex = null;

      const oldWidth = containerEl.clientWidth;
      if (split.direction == 'vertical') {
        // adjust the width (if necessary)
        if (this.settings.stackingEnabled && (this.settings.leafAutoWidth || this.settings.leafWidth >= stackedWidth)) {
          containerEl.style.minWidth = stackedWidth + "px";
        }
        else if (this.settings.leafWidth >= splitWidth) {
          containerEl.style.minWidth = splitWidth + "px";
        }
        else {
          containerEl.style.minWidth = null;
        }

        // calculate left/right sticky points
        containerEl.style.left = this.settings.stackingEnabled 
          ? (i * this.settings.headerWidth) + "px"
          : null;
        containerEl.style.right = this.settings.stackingEnabled
          ? (((leafCount - i) * this.settings.headerWidth) - containerEl.clientWidth) + "px"
          : null;
      }
      else {
        containerEl.style.minWidth = null;
        containerEl.style.left = null;
        containerEl.style.right = null;
      }

      const oldHeight = containerEl.clientHeight;
      if (split.direction == 'horizontal' && this.settings.horizontalSliding) {
        // adjust the height (if necessary)
        if (this.settings.horizontalStackingEnabled && (this.settings.leafAutoHeight || this.settings.leafHeight >= stackedHeight)) {
          containerEl.style.minHeight = stackedHeight + "px";
        }
        else if (this.settings.leafHeight >= splitHeight) {
          containerEl.style.minHeight = splitHeight + "px";
        }
        else {
          containerEl.style.minHeight = null;
        }

        containerEl.style.top = this.settings.horizontalStackingEnabled
          ? (i * this.settings.headerWidth) + "px"
          : null;
        containerEl.style.bottom = this.settings.horizontalStackingEnabled
          ? (((leafCount - i) * this.settings.headerWidth) - containerEl.clientHeight) + "px"
          : null;
      }
      else {
        containerEl.style.minHeight = null;
        containerEl.style.top = null;
        containerEl.style.bottom = null;
      }

      if (oldWidth != containerEl.clientWidth) widthChange = true;
      if (oldHeight != containerEl.clientWidth) heightChange = true;
      
      // // keep track of the total width of all leaves
      // totalWidth += containerEl.clientWidth;
      // totalHeight += containerEl.clientHeight;

      // add in a label for the note's title
      if (leaf instanceof WorkspaceLeaf) {
        this.updateLeafTitle(leaf)
      }
      // loop through any child splits and process them
      else if (leaf instanceof WorkspaceSplit) this.recalculateLeaves(leaf as WorkspaceSplit as WorkspaceSplitExt);
      else console.error("unknown workspace item!", leaf);
    });

    // // if the total width of all leaves is less than the width available,
    // // add back the flex class so they fill the space
    // if ((split.direction == 'vertical' && totalWidth < split.containerEl.clientWidth)
    //   || (split.direction == 'horizontal' && totalHeight < split.containerEl.clientHeight)) {
    //   split.children.forEach((leaf: any) => {
    //     leaf.containerEl.style.flex = '1 0 0';
    //   });
    // }

    if(widthChange || heightChange) this.focusActiveLeaf(!this.settings.leafAutoWidth);
  }

  updateLeafTitle(leaf: WorkspaceLeafExt) {
    leaf.containerEl.setAttribute("data-title", leaf.getDisplayText());
    const iconEl = (leaf.view as any).iconEl;
    const iconText = iconEl.getAttribute("aria-label");
    if (!iconText.includes("(")) {
      iconEl.setAttribute("aria-label", `${leaf.getDisplayText()} (${iconText})`);
    }
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

  focusLeaf = (activeLeaf: WorkspaceItemExt, animated: boolean = true) => {
    if (activeLeaf != null) {
      const parentSplit = activeLeaf.parentSplit;
      const parentContainerEl = parentSplit.containerEl;
      const leaves = parentSplit.children;
      const leafCount = leaves.length;
      const splitDirection = parentSplit.direction;
      
      // get the index of the leaf
      // also, get the position of this leaf, so we can scroll to it
      // as leaves are resizable, we have to iterate through all prior leaves
      // until we get to the active one and add all their widths/heights together
      let positionH = 0;
      let positionV = 0;
      let leafIndex = -1;
      leaves.forEach((leaf: WorkspaceItemExt, index: number) => {
        const containerEl = leaf.containerEl;

        if (leaf == activeLeaf) {
          // if this is the active one
          leafIndex = index;
          containerEl.classList.remove('mod-am-pre-active');
          containerEl.classList.remove('mod-am-post-active');
        }
        else if (leafIndex == -1 || index < leafIndex) {
          // this is before the active one, add the width
          positionH += containerEl.clientWidth;
          positionV += containerEl.clientHeight;
          containerEl.classList.add('mod-am-pre-active');
          containerEl.classList.remove('mod-am-post-active');
        }
        else {
          // this is after the active one
          containerEl.classList.remove('mod-am-pre-active');
          containerEl.classList.add('mod-am-post-active');
        }
      });

      // get this leaf's left value (the amount of space to the left for sticky headers)
      const left = parseInt(activeLeaf.containerEl.style.left) || 0;
      const top = parseInt(activeLeaf.containerEl.style.top) || 0;

      // the amount of space to the right we need to leave for sticky headers
      const headersToRightWidth = this.settings.stackingEnabled ? (leafCount - leafIndex - 1) * this.settings.headerWidth : 0;
      if (splitDirection == 'horizontal') {
        // it's too far up
        if (parentContainerEl.scrollTop > positionV - top) {
          // scroll the top of the pane into view
          parentContainerEl.scrollTo({ top: positionV - top, left: 0, behavior: animated ? 'smooth' : 'auto' });
        }
        // it's too far right
        else if (parentContainerEl.scrollTop + parentContainerEl.clientHeight < positionV + activeLeaf.containerEl.clientHeight + headersToRightWidth) {
          // scroll the right side of the pane into view
          parentContainerEl.scrollTo({ top: positionV + activeLeaf.containerEl.clientHeight + headersToRightWidth - parentContainerEl.clientHeight, left: 0, behavior: animated ? 'smooth' : 'auto' });
        }
      }
      else {
        // it's too far left
        if (parentContainerEl.scrollLeft > positionH - left) {
          // scroll the left side of the pane into view
          parentContainerEl.scrollTo({ left: positionH - left, top: 0, behavior: animated ? 'smooth' : 'auto' });
        }
        // it's too far right
        else if (parentContainerEl.scrollLeft + parentContainerEl.clientWidth < positionH + activeLeaf.containerEl.clientWidth + headersToRightWidth) {
          // scroll the right side of the pane into view
          parentContainerEl.scrollTo({ left: positionH + activeLeaf.containerEl.clientWidth + headersToRightWidth - parentContainerEl.clientWidth, top: 0, behavior: animated ? 'smooth' : 'auto' });
        }
      }

      if (parentSplit != this.app.workspace.rootSplit) {
        this.focusLeaf(parentSplit as WorkspaceItem as WorkspaceItemExt);
      }
    }
  }

  focusActiveLeaf = (animated: boolean = true) => {
    const activeLeaf = this.app.workspace.activeLeaf as WorkspaceItem;
    if (activeLeaf && activeLeaf.getRoot() == this.app.workspace.rootSplit) {
      this.updateLeafTitle(activeLeaf as WorkspaceLeafExt);
      this.focusLeaf(activeLeaf as WorkspaceItemExt, animated);
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

  }
}