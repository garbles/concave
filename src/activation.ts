import { Unsubscribe } from "./types";

type State = { connected: false } | { connected: true; unsubscribe: Unsubscribe };

export class Activation {
  static null() {
    return new Activation(() => () => {});
  }

  private state: State = { connected: false };

  constructor(private subscribe: () => Unsubscribe) {}

  get connected() {
    return this.state.connected;
  }

  connect() {
    if (this.state.connected) {
      return;
    }

    const unsubscribe = this.subscribe();

    this.state = {
      connected: true,
      unsubscribe,
    };
  }

  disconnect() {
    if (!this.state.connected) {
      return;
    }

    this.state.unsubscribe();

    this.state = {
      connected: false,
    };
  }
}
