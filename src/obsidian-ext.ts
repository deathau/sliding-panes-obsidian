import { WorkspaceItem, WorkspaceParent } from 'obsidian';

export interface WorkspaceItemExt extends WorkspaceItem {
  // the parent of the item
  parentSplit: WorkspaceParentExt;

  // the container element
  containerEl: HTMLElement;
}

// interface for extending WorkspaceParent with undocumented properties
export interface WorkspaceParentExt extends WorkspaceParent, WorkspaceItemExt {
  // the child items of the split
  children: WorkspaceItemExt[];
}