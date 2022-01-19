import { Store } from ".";
import { BreakerLike, Breaker } from "./breaker";
import { Listener, Unsubscribe } from "./types";

type Resolution<A> = { status: "unresolved" } | { status: "loading" } | { status: "resolved"; value: A };

const noop: Listener = () => {};

export class SuspendedClosure<A> implements BreakerLike, Store<A> {
  private subscriptions = new Set<Unsubscribe>();
  private resolution: Resolution<A> = { status: "unresolved" };
  private breaker = Breaker.noop();
  private onReady: Promise<unknown>;
  private ready: () => void;

  constructor() {
    let ready = () => {};

    this.onReady = new Promise<void>((resolve) => {
      ready = resolve;
    });

    this.ready = () => ready();
  }

  getSnapshot(): A {
    if (this.resolution.status !== "resolved") {
      throw this.onReady;
    }

    return this.resolution.value;
  }

  setSnapshot(value: A): boolean {
    switch (this.resolution.status) {
      case "unresolved": {
        return false;
      }

      case "loading": {
        this.resolution = { status: "resolved", value };
        this.ready();
        this.notify();
        return true;
      }

      case "resolved": {
        this.resolution.value = value;
        this.notify();
        return true;
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
     * If the entry was previously unresolved, but connected—via subscribe—then
     * we need to actually call the `connect()` function because we've now been given the
     * real subscribe function.
     */
    const isAlreadyConnected = this.breaker.connected;

    this.breaker = new Breaker(subscribe);

    if (isAlreadyConnected) {
      this.breaker.connect();
    }
  }

  connect() {
    this.breaker.connect();
  }

  disconnect() {
    this.breaker.disconnect();
  }

  subscribe(listener = noop): Unsubscribe {
    this.subscriptions.add(listener);

    return () => {
      this.subscriptions.delete(listener);
    };
  }

  private notify() {
    this.subscriptions.forEach((fn) => fn());
  }
}
