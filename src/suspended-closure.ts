import { Activation } from "./activation";
import { Unsubscribe } from "./types";

type Resolution<A> = { status: "unresolved" } | { status: "loading" } | { status: "resolved"; value: A };

export class SuspendedClosure<A> {
  private resolution: Resolution<A> = { status: "unresolved" };
  private activation = Activation.null();
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

    this.resolution = { status: "loading" };

    /**
     * If the entry was previously unresolved, but connected - via subscribe - then
     * we need to actually call the `create` function
     */
    const connected = this.activation.connected;
    this.activation = new Activation(subscribe);

    if (connected) {
      this.activation.connect();
    }
  }

  connect() {
    this.activation.connect();
  }

  disconnect() {
    this.activation.disconnect();
  }
}
