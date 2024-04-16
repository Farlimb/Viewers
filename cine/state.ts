import { getEnabledElement } from '@cornerstonejs/core';
import { ToolData } from './CINETypes';

const state: Record<string, ToolData> = {};

function addToolState(element: HTMLDivElement, data: ToolData): void {
  const enabledElement = getEnabledElement(element);
  const { viewportId } = enabledElement;
  state[viewportId] = data;
}

function getToolState(element: HTMLDivElement): ToolData | undefined {
  const enabledElement = getEnabledElement(element);
  const { viewportId } = enabledElement;
  return state[viewportId];
}

function getToolStateByViewportId(viewportId: string): ToolData | undefined {
  return state[viewportId];
}

export { addToolState, getToolState, getToolStateByViewportId };
