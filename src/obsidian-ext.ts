import { SplitDirection, WorkspaceItem, WorkspaceLeaf, WorkspaceSplit } from 'obsidian';

export interface WorkspaceItemExt extends WorkspaceItem {
  parentSplit: WorkspaceSplit;
  containerEl: HTMLElement;
}

export interface WorkspaceLeafExt extends WorkspaceLeaf {
  parentSplit: WorkspaceSplit;
  containerEl: HTMLElement;
}

export interface WorkspaceSplitExt extends WorkspaceSplit {
  children: WorkspaceItemExt[];
  containerEl: HTMLElement;
  parentSplit: WorkspaceSplit;
  direction: SplitDirection;
}