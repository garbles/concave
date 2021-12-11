import React from "react";
import { basicLens, BasicLens } from "./basic-lens";
import { externalStore } from "./external-store";
import { proxyLens, ProxyLens } from "./proxy-lens";
import { useSyncExternalStoreWithLens } from "./use-sync-external-store-with-lens";

export const testLens = <S>(initialState: S): [ProxyLens<S>, React.MutableRefObject<S>] => {
  const store = externalStore(initialState);

  const lens = proxyLens<S, S>({
    lens: basicLens(),
    createUse<A>(lens: BasicLens<S, A>) {
      return () => useSyncExternalStoreWithLens(store, lens);
    },
  });

  const ref: React.MutableRefObject<S> = {
    get current() {
      return store.getSnapshot();
    },
    set current(next) {
      store.apply(() => next);
    },
  };

  return [lens, ref];
};
