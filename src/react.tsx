/// <reference types="react/next" />

import React from "react";
import { basicLens, BasicLens } from "./basic-lens";
import { externalStore, ExternalStore } from "./external-store";
import { proxyLens } from "./proxy-lens";
import { ShouldUpdate } from "./should-update";
import { useSyncExternalStoreWithLens } from "./use-sync-external-store-with-lens";

type LensProviderProps<S> = {
  value: S;
  onChange(next: S): void;
};

type LensProviderComponent<S> = React.FC<LensProviderProps<S>>;

type Nothing = typeof nothing;
const nothing = Symbol();

export const stateless = <S,>() => {
  const ExternalStoreContext = React.createContext<ExternalStore<S> | Nothing>(nothing);
  ExternalStoreContext.displayName = "Lens(ExternalStoreContext)";

  const createUse =
    <A,>(lens: BasicLens<S, A>) =>
    (shouldUpdate?: ShouldUpdate<A>) => {
      const store = React.useContext(ExternalStoreContext);

      if (store === nothing) {
        throw new Error("Cannot call `lens.use()` in a component outside of <LensProvider />");
      }

      return useSyncExternalStoreWithLens(store, lens, shouldUpdate);
    };

  const lens = proxyLens<S, S>({
    lens: basicLens(),
    createUse,
  });

  const LensProvider: LensProviderComponent<S> = (props) => {
    const storeRef = React.useRef<ExternalStore<S>>();
    if (!storeRef.current) {
      storeRef.current = externalStore(props.value);
    }
    let store = storeRef.current;

    React.useEffect(() => {
      if (store.getSnapshot() !== props.value) {
        store.update(() => props.value);
      }
    }, [props.value]);

    React.useEffect(() => {
      return store.subscribe(() => props.onChange(store.getSnapshot()));
    }, [props.onChange]);

    return <ExternalStoreContext.Provider value={store}>{props.children}</ExternalStoreContext.Provider>;
  };
  LensProvider.displayName = "Lens(Provider)";

  return [lens, LensProvider] as const;
};

export const stateful = <S,>(initialState: S) => {
  const store = externalStore(initialState);

  const lens = proxyLens<S, S>({
    lens: basicLens(),
    createUse: (lens) => (shouldUpdate) => useSyncExternalStoreWithLens(store, lens, shouldUpdate),
  });

  const ref: React.MutableRefObject<S> = {
    get current() {
      return store.getSnapshot();
    },
    set current(next) {
      store.update(() => next);
    },
  };

  return [lens, ref] as const;
};
