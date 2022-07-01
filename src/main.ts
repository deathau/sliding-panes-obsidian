import { FileView, TAbstractFile, WorkspaceLeaf, Platform, WorkspaceWindow, WorkspaceParent, WorkspaceItem } from 'obsidian';
import { WorkspaceExt, WorkspaceItemExt, WorkspaceParentExt } from './obsidian-ext';
import { SlidingPanesSettings, SlidingPanesSettingTab, SlidingPanesCommands, Orientation } from './settings';
import { PluginBase } from './plugin-base'

const MIN_PANE_WIDTH = 200;
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
      this.registerEvent(this.app.workspace.on('window-open', this.handleWindowOpen))
      this.registerEvent(this.app.vault.on('delete', this.handleDelete));

      // wait for layout to be ready to perform the rest
      if(this.app.workspace.layoutReady) this.reallyEnable() 
    }
  }

  handleWindowOpen = (window: WorkspaceWindow) => {
    this.swizzleChildResize(window as WorkspaceParent as WorkspaceParentExt)
  }

  // really enable things (once the layout is ready)
  reallyEnable = () => {
    // we don't need the event handler anymore
    this.app.workspace.off('layout-ready', this.reallyEnable);

    // add some extra classes that can't fit in the styles.css
    // because they use settings
    this.addStyle();

    // get and loop through the root splits (there may be more than one if using popout windows)
    const rootSplits = this.getRootSplits();
    rootSplits.forEach((rootSplit: WorkspaceParentExt) => {
      this.swizzleChildResize(rootSplit)
    });

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
      this.unswizzleChildResize(rootSplit)
      const rootLeaves:WorkspaceItemExt[] = rootSplit.children

      // loop through all the leaves
      rootLeaves.forEach(this.clearLeaf);
    });

    this.app.workspace.off('resize', this.handleResize)
    this.app.workspace.off('layout-change', this.handleLayoutChange)
    this.app.workspace.off('active-leaf-change', this.handleActiveLeafChange)
    this.app.workspace.off('window-open', this.handleWindowOpen)
    this.app.vault.off('delete', this.handleDelete)
  }

  clearLeaf = (leaf: any) => {
    leaf.containerEl.style.width = null
    leaf.containerEl.style.left = null
    leaf.containerEl.style.right = null
    leaf.containerEl.style.flex = null
    leaf.containerEl.style.flexGrow = leaf.dimension
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

  unswizzleChildResize = (rootSplit: WorkspaceParentExt) => {
    rootSplit.onChildResizeStart = rootSplit.oldChildResizeStart;
  }

  swizzleChildResize = (rootSplit: WorkspaceParentExt) => {
    rootSplit.oldChildResizeStart = rootSplit.onChildResizeStart
    rootSplit.onChildResizeStart = (leaf: WorkspaceItemExt, event: MouseEvent) => {
      // only really apply this to vertical splits
      if (rootSplit.direction === "vertical") {
        // this is the width the leaf started at before resize
        const startWidth = leaf.width;
  
        // the mousemove event to trigger while resizing
        const mousemove = (e: any) => {
          // get the difference between the first position and current
          const deltaX = e.pageX - event.pageX;
          // adjust the start width by the delta
          leaf.width = startWidth + deltaX
          if(leaf.width < MIN_PANE_WIDTH) leaf.width = MIN_PANE_WIDTH;
          leaf.containerEl.style.width = leaf.width + "px";
        }
  
        // the mouseup event to trigger at the end of resizing
        const mouseup = () => {
          // if stacking is enabled, we need to re-jig the "right" value
          if (this.settings.stackingEnabled) {
            // we need the leaf count and index to calculate the correct value
            const rootLeaves = rootSplit.children;
            const leafCount = rootLeaves.length;
            const leafIndex = rootLeaves.findIndex((l: any) => l == leaf);
            for(var i = leafIndex; i < leafCount; i++) {
              rootLeaves[i].containerEl.style.right = (((leafCount - i) * this.settings.headerWidth) - rootLeaves[i].width) + "px";
            }
          }
  
          // remove these event listeners. We're done with them
          rootSplit.doc.removeEventListener("mousemove", mousemove);
          rootSplit.doc.removeEventListener("mouseup", mouseup);
          document.body.removeClass("is-grabbing");
        }
  
        // Add the above two event listeners
        rootSplit.doc.addEventListener("mousemove", mousemove);
        rootSplit.doc.addEventListener("mouseup", mouseup);
        document.body.addClass("is-grabbing")
      }
    }
  }

  // Recalculate the leaf sizing and positions
  recalculateLeaves = () => {
    let activeLeaf: WorkspaceItemExt = this.app.workspace.getLeaf() as WorkspaceItem as WorkspaceItemExt;
    // get and loop through the root splits (there may be more than one if using popout windows)
    const rootSplits = this.getRootSplits();
    rootSplits.forEach((rootSplit: WorkspaceParentExt) => {
      const rootContainerEl:HTMLElement = rootSplit.containerEl

      // get the client width of the root container once, before looping through the leaves
      const rootContainerElWidth = rootContainerEl.clientWidth
      
      const rootLeaves:WorkspaceItemExt[] = rootSplit.children
      let leafCount = rootLeaves.length;

      const leafWidth = this.settings.leafAutoWidth 
        ? (rootContainerElWidth - ((leafCount - 1) * this.settings.headerWidth))
        : (Platform.isDesktop ? this.settings.leafDesktopWidth : this.settings.leafMobileWidth);
        
      let totalWidthEstimate = leafCount * leafWidth;
      let totalWidth = 0;
      let widthChange = false;

      // loop through all the leaves
      rootLeaves.forEach((leaf: WorkspaceItemExt, i:number) => {
        const containerEl = leaf.containerEl;
        // the default values for the leaf
        let flex = '1 0 0'
        let width = leaf.width;
        // if the leaf was previously "flex", then the width will be out of whack
        if(containerEl.style.flexBasis) width = leafWidth
        let left = null
        let right = null

        if (totalWidthEstimate > rootContainerElWidth) {
          // if the total width is greater than the root container width, we need to limit the leaves
          flex = null
          if(!width) width = leafWidth
          if(this.settings.stackingEnabled){
            // if stacking is enabled, we need to set the left and right values
            left = (i * this.settings.headerWidth) + "px"
            right = (((leafCount - i) * this.settings.headerWidth) - leafWidth) + "px"
          }
        }

        // set the html attributes for the leaf (if they have changed)
        if(containerEl.style.flex != flex || containerEl.style.width != width + "px" || containerEl.style.left != left || containerEl.style.right != right){
          widthChange = containerEl.style.width != width + "px"
          const style = {flex, left, right, width: width + "px"}
          Object.assign(containerEl.style, style)
        }

        // set the leaf's width for later reference
        leaf.width = width
        totalWidth += width

        if(leaf instanceof WorkspaceLeaf){
          const iconEl = (leaf.view as any).iconEl;
          const iconText = iconEl.getAttribute("aria-label");
          if (!iconText.includes("(")) {
            iconEl.setAttribute("aria-label", `${leaf.getDisplayText()} (${iconText})`);
          }
        }
      });

      // if the active leaf is in the current container, and the width has changed, refocus the active leaf
      if(activeLeaf.getContainer() as unknown as WorkspaceParentExt === rootSplit && widthChange) this.focusLeaf(activeLeaf, !this.settings.leafAutoWidth);
    })
  }

  handleActiveLeafChange = (leaf: WorkspaceLeaf | null) =>{
    if (leaf) {
      this.focusLeaf(leaf as WorkspaceItem as WorkspaceItemExt);
    }
  }
  
  focusLeaf(activeLeaf:WorkspaceItemExt, animated: boolean = true) {
    const rootSplit = activeLeaf.getContainer() as unknown as WorkspaceParentExt;
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

    const floatingSplit = (this.app.workspace as WorkspaceExt).floatingSplit as WorkspaceParentExt;
    floatingSplit.children.forEach((child: WorkspaceParentExt) => {
      // if this is a window, push it to the list 
      if (child instanceof WorkspaceWindow) {
        rootSplits.push(child);
      }
    });

    return rootSplits;
  }
}
