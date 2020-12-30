import { WorkspaceItem, WorkspaceSplit } from 'obsidian';

export interface WorkspaceItemExt extends WorkspaceItem {
  parentSplit: WorkspaceSplit;
  containerEl: HTMLElement;
}