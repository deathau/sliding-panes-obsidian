import { FileView, TAbstractFile, WorkspaceLeaf, Platform, WorkspaceWindow, WorkspaceParent, WorkspaceItem } from 'obsidian';
import { WorkspaceItemExt, WorkspaceParentExt } from './obsidian-ext';
import { SlidingPanesSettings, SlidingPanesSettingTab, SlidingPanesCommands, Orientation } from './settings';
import { PluginBase } from './plugin-base'


export default class SlidingPanesPlugin extends PluginBase {
  settings: SlidingPanesSettings;

  // helper variables
  private activeLeafIndex: number = 0;

  private prevRootLeaves: WorkspaceItemExt[] = [];
  
  // runs when the plugin is loaded
  onload = async () => {
    // load settings
    this.settings = Object.assign(new SlidingPanesSettings(), await this.loadData());

    // add in the required command pallete commands
    this.addCommands();

    // add in any settings
    this.addSettings();

    // wait for layout to be ready to perform the rest
    this.app.workspace.onLayoutReady(this.onLayoutReady);
  }

  // add in any required command pallete commands
  addCommands = () => {
    // add the commands
    new SlidingPanesCommands(this).addCommands();
  }

  // add in any settings
  addSettings = () => {
    // add the settings tab
    this.addSettingTab(new SlidingPanesSettingTab(this.app, this));
  }

  // enable andy mode
  enable = () => {
    if(!this.settings?.disabled) {
      // add the event handlers
      this.registerEvent(this.app.workspace.on('resize', this.handleResize));
      this.registerEvent(this.app.workspace.on('layout-change', this.handleLayoutChange));
      this.registerEvent(this.app.workspace.on('active-leaf-change', this.handleActiveLeafChange));
      this.registerEvent(this.app.vault.on('delete', this.handleDelete));

      // wait for layout to be ready to perform the rest
      if(this.app.workspace.layoutReady) this.reallyEnable() 
    }
  }

  // really enable things (once the layout is ready)
  reallyEnable = () => {
    // we don't need the event handler anymore
    this.app.workspace.off('layout-ready', this.reallyEnable);

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

    // get and loop through the root splits (there may be more than one if using popout windows)
    const rootSplits = this.getRootSplits();
    rootSplits.forEach((rootSplit: WorkspaceParentExt) => {
      const rootLeaves:WorkspaceItemExt[] = rootSplit.children

      // loop through all the leaves
      rootLeaves.forEach(this.clearLeaf);
    });
  }

  clearLeaf = (leaf: any) => {
    leaf.containerEl.style.width = null;
    leaf.containerEl.style.left = null;
    leaf.containerEl.style.right = null;
    leaf.containerEl.classList.remove('mod-am-left-of-active');
    leaf.containerEl.classList.remove('mod-am-right-of-active');

    const iconEl = leaf.view.iconEl;
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
        if (Platform.isDesktop) {
          el.innerText += `body.plugin-sliding-panes .mod-root>.workspace-leaf,body.plugin-sliding-panes .mod-root>.workspace-split{width:${this.settings.leafDesktopWidth + this.settings.headerWidth}px;}`;
        }
        else {
          el.innerText += `body.plugin-sliding-panes .mod-root>.workspace-leaf,body.plugin-sliding-panes .mod-root>.workspace-split{width:${this.settings.leafMobileWidth + this.settings.headerWidth}px;}`;
        }
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

    // get and loop through the root splits (there may be more than one if using popout windows)
    const rootSplits = this.getRootSplits();
    const rootLeaves:WorkspaceItemExt[] = [];
    rootSplits.forEach((rootSplit: WorkspaceParentExt) => {
      rootLeaves.push(...rootSplit.children)
    });
    if (rootLeaves.length < this.prevRootLeaves.length) {
      this.prevRootLeaves.forEach((leaf: any) => {
        if (!rootLeaves.contains(leaf)) {
          this.clearLeaf(leaf);
        }
      })
    }
    this.prevRootLeaves = rootLeaves;
    //this.recalculateLeaves();
  }

  // Recalculate the leaf sizing and positions
  recalculateLeaves = () => {
    // get and loop through the root splits (there may be more than one if using popout windows)
    const rootSplits = this.getRootSplits();
    rootSplits.forEach((rootSplit: WorkspaceParentExt) => {
      const rootContainerEl:HTMLElement = rootSplit.containerEl

      // get the client width of the root container once, before looping through the leaves
      const rootContainerElWidth = rootContainerEl.clientWidth
      
      const rootLeaves:WorkspaceItemExt[] = rootSplit.children
      let leafCount = rootLeaves.length;
      let totalWidth = 0;
      let widthChange = false;

      // loop through all the leaves
      rootLeaves.forEach((leaf: WorkspaceItemExt, i:number) => {
      
        const containerEl = leaf.containerEl;

        // if the leaf still has flex, remove it
        if(containerEl.style.flex) containerEl.style.flex = null;
        // get the current width of the leaf's element
        const oldWidth = containerEl.clientWidth;

        let newWidth = oldWidth;

        // if using auto-width, calculate the appropriate width
        if (this.settings.leafAutoWidth) {
          newWidth = (rootContainerElWidth - ((leafCount - 1) * this.settings.headerWidth));
          // if the width is not correct, update it
          if(oldWidth != newWidth) {
            containerEl.style.width = newWidth + "px"
            widthChange = true;
          }
        }
        else {
          if(containerEl.style.width){
            containerEl.style.width = null;
            widthChange = true;
          }
        }

        // set left and right for sticky headers
        const newLeft = this.settings.stackingEnabled
          ? (i * this.settings.headerWidth) + "px"
          : null;
        if(newLeft != containerEl.style.left) containerEl.style.left = newLeft

        const newRight = this.settings.stackingEnabled
          ? (((leafCount - i) * this.settings.headerWidth) - newWidth) + "px"
          : null;
        if(newRight != containerEl.style.right) containerEl.style.right = newRight

        // keep track of the total width of all leaves
        totalWidth += newWidth;
      });

      // if the total width is less than that of the root container, we can go back to the flex layout
      if (totalWidth < rootContainerElWidth) {
      rootLeaves.forEach((leaf: any) => {
          leaf.containerEl.style.flex = '1 0 0';
        });
      }

      let activeLeaf: WorkspaceItemExt = this.app.workspace.getLeaf() as WorkspaceItem as WorkspaceItemExt;
      // if the active leaf is in the current container, and the width has changed, refocus the active leaf
      // @ts-ignore because WorkspaceContainer doesn't overlap with WorkspaceParent, but the container *will be* a WorkspaceParent, so do it anyway
      if(activeLeaf.getContainer() === rootSplit && widthChange) this.focusLeaf(activeLeaf, !this.settings.leafAutoWidth);
    })
  }

  handleActiveLeafChange = (leaf: WorkspaceLeaf | null) =>{
    if (leaf) {
      this.focusLeaf(leaf as WorkspaceItem as WorkspaceItemExt);
    }
  }
  
  focusLeaf(activeLeaf:WorkspaceItemExt, animated: boolean = true) {
    // @ts-ignore because WorkspaceContainer doesn't overlap with WorkspaceParent, but the container *will be* a WorkspaceParent, so do it anyway
    const rootSplit = activeLeaf.getContainer() as WorkspaceParentExt;
    while (activeLeaf != null && activeLeaf.parentSplit != null && activeLeaf.parentSplit !== rootSplit) {
      activeLeaf = activeLeaf.parentSplit;
    }

    if (activeLeaf != null && activeLeaf.parentSplit != null && activeLeaf.parentSplit === rootSplit) {

      const rootContainerEl = rootSplit.containerEl;
      const rootLeaves = rootSplit.children;
      const leafCount = rootLeaves.length;

      // get the index of the active leaf
      // also, get the position of this leaf, so we can scroll to it
      // as leaves are resizable, we have to iterate through all leaves to the
      // left until we get to the active one and add all their widths together
      let position = 0;
      this.activeLeafIndex = -1;
      rootLeaves.forEach((leaf: WorkspaceItemExt, index: number) => {
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

  getRootSplits = ():WorkspaceParentExt[] => {
    const rootSplits:WorkspaceParentExt[] = [];

    // push the main window's root split to the list
    rootSplits.push(this.app.workspace.rootSplit as WorkspaceParent as WorkspaceParentExt)

    // @ts-ignore floatingSplit is undocumented
    const floatingSplit = this.app.workspace.floatingSplit as WorkspaceParentExt;
    floatingSplit.children.forEach((child: WorkspaceParentExt) => {
      // if this is a window, push it to the list 
      if (child instanceof WorkspaceWindow) {
        rootSplits.push(child);
      }
    });

    return rootSplits;
  }
}
