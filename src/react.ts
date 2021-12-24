/// <reference types="react/next" />

import React from "react";
import { ProxyLens } from "./proxy-lens";
import { proxyValue, ProxyValue } from "./proxy-value";
import { ShouldUpdate, shouldUpdateToFunction } from "./should-update";
import { Update } from "./types";

type Nothing = typeof NOTHING;

const NOTHING = Symbol();
const SHOULD_ALWAYS_RETURN_NEXT = () => true;

export type Lens<A> = ProxyLens<A>;

export function useLens<A>(
  proxy: ProxyLens<A>,
  shouldUpdate: ShouldUpdate<A> = SHOULD_ALWAYS_RETURN_NEXT
): [ProxyValue<A>, Update<A>] {
  React.useDebugValue(proxy.$key);

  /**
   * Memoize store from proxy. Proxy should never change, so this should be static.
   */
  const store = React.useMemo(() => proxy.getStore(), [proxy]);

  /**
   * Memoize shouldUpdate into a function.
   */
  const shouldUpdateFn = React.useMemo(() => shouldUpdateToFunction(shouldUpdate), [shouldUpdate]);

  /**
   * Track the previously resolved state, starting with `Nothing`.
   */
  const prevStateRef = React.useRef<A | Nothing>(NOTHING);

  const getSnapshot = () => {
    const prev = prevStateRef.current;
    const next = store.getSnapshot();

    /**
     * If `prev` _is_ `next` then we should bail because nothing changed.
     */
    if (Object.is(prev, next)) {
      return prev as A;
    }

    /**
     * If the `prev` is `Nothing` then this is the first render,
     * so just take `next.
     */
    if (prev === NOTHING) {
      return next;
    }

    /**
     * If we should update then return the `next`, else return `prev`
     */
    if (shouldUpdateFn(prev, next)) {
      return next;
    } else {
      return prev;
    }
  };

  const state = React.useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
  const setState = store.update;

  /**
   * Assign the current state to the previous state so that when `getSnapshot`
   * is called again it will reference it.
   */
  prevStateRef.current = state;

  /**
   * Wrap the state in a proxy value so that it can be transformed back into a lens.
   */
  const value = React.useMemo(() => proxyValue(state, proxy), [state, proxy]);

  return [value, setState];
}
