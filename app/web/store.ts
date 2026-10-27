import type { Action, AppState } from "../../common/appState";
import { reduce } from "../../common/appState";

type Listener = (state: AppState) => void;

export class Store {
  private state: AppState;
  private listeners = new Set<Listener>();

  constructor(state: AppState) {
    this.state = state;
  }

  get(): AppState {
    return this.state;
  }

  dispatch(action: Action) {
    const next = reduce(this.state, action);
    if (next !== this.state) {
      this.state = next;
      for (const listener of this.listeners) {
        listener(this.state);
      }
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }
}

let counter = 0;
export function nextToken(): number {
  counter += 1;
  return counter;
}
