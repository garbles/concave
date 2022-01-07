import { Unsubscribe } from "./types";

type Resolution<A> = { status: "unresolved" } | { status: "loading" } | { status: "resolved"; value: A };
type Activation = { connected: false } | { connected: true; unsubscribe: Unsubscribe };

export class SuspendedClosure<A> {
  private resolution: Resolution<A> = { status: "unresolved" };
  private activation: Activation = { connected: false };
  private subscribe: () => Unsubscribe = () => () => {};
  private onReady: Promise<unknown>;
  private ready: () => void;

  constructor() {
    let ready = () => {};

    this.onReady = new Promise<void>((resolve) => {
      ready = resolve;
    });

    this.ready = () => ready();
  }

  get value(): A {
    if (this.resolution.status !== "resolved") {
      throw this.onReady;
    }

    return this.resolution.value;
  }

  set value(value: A) {
    switch (this.resolution.status) {
      case "unresolved": {
        return;
      }

      case "loading": {
        this.resolution = { status: "resolved", value };
        this.ready();

        return;
      }

      case "resolved": {
        this.resolution.value = value;
        return;
      }
    }
  }

  /**
   * Connect the entry to the store by passing a subscribe function. Only
   * allow this in transitioning from unresolved to resolved.
   */
  load(subscribe: () => Unsubscribe) {
    if (this.resolution.status !== "unresolved") {
      return;
    }

    this.subscribe = subscribe;
    this.resolution = { status: "loading" };

    /**
     * If the entry was previously unresolved, but connected - via subscribe - then
     * we need to actually call the `create` function
     */
    if (this.activation.connected) {
      this.activation = { connected: true, unsubscribe: subscribe() };
    }
  }

  connect() {
    if (this.activation.connected) {
      return;
    }

    const unsubscribe = this.subscribe();

    this.activation = {
      connected: true,
      unsubscribe,
    };
  }

  disconnect() {
    if (!this.activation.connected) {
      return;
    }

    this.activation.unsubscribe();

    this.activation = {
      connected: false,
    };
  }
}
