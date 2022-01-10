import { Unsubscribe } from "./types";

type State = { connected: false } | { connected: true; unsubscribe: Unsubscribe };

export interface BreakerLike {
  connect(): void;
  disconnect(): void;
}

export class Breaker implements BreakerLike {
  static noop() {
    return new Breaker(() => () => {});
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

    const unsubscribe = this.subscribe.call(null);

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
