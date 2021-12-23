/// <reference types="react/next" />

import React from "react";
import { basicLens } from "./basic-lens";
import { externalStore, ExternalStore } from "./external-store";
import { keyPathToString } from "./key-path-to-string";
import { initProxyLens } from "./proxy-lens";
import { useExternalStoreHandler } from "./use-external-store-handler";

type LensProviderProps<S> = {
  value: S;
  onChange(next: S): void;
};

type LensProviderComponent<S> = React.FC<LensProviderProps<S>>;

type Nothing = typeof NOTHING;
const NOTHING = Symbol();

const useExternalStore = <S,>(value: S, onChange: (s: S) => void): ExternalStore<S> => {
  const store = React.useMemo(() => externalStore(value), []);
  const handler = React.useMemo(() => store({ keyPath: [], lens: basicLens() }), []);

  /**
   * If the value from props has changed, then let the store trigger an update.
   * If it is the same value as what is currently in the store, then it will noop.
   */
  React.useEffect(() => {
    handler.update(() => value);
  }, [value]);

  /**
   * Use a ref to track the onChange handler so that we are never required to unsubscribe/resubscribe
   * when it changes. Lets the developer out of having to use `React.useCallback`.
   */
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  /**
   * Subscribe to changes in the same way `useLens` hooks do.
   */
  React.useEffect(() => handler.subscribe(() => onChangeRef.current(handler.getSnapshot())), []);

  return store;
};

export const stateless = <S,>(displayName = "Lens") => {
  const ExternalStoreContext = React.createContext<ExternalStore<S> | Nothing>(NOTHING);
  ExternalStoreContext.displayName = `${displayName}(ExternalStoreContext)`;

  const lens = initProxyLens<S>((focus) => {
    const debugValue = keyPathToString(focus.keyPath);

    /**
     * Explicitly name the function here so that it shows up nicely in React Devtools.
     */
    return function useStatelessLensState(shouldUpdate) {
      React.useDebugValue(debugValue);

      const store = React.useContext(ExternalStoreContext);

      if (store === NOTHING) {
        throw new Error("Cannot call `lens.use()` in a component outside of <LensProvider />");
      }

      const handler = React.useMemo(() => store(focus), []);
      return useExternalStoreHandler(handler, shouldUpdate);
    };
  });

  const LensProvider: LensProviderComponent<S> = (props) => {
    const store = useExternalStore(props.value, props.onChange);
    return <ExternalStoreContext.Provider value={store}>{props.children}</ExternalStoreContext.Provider>;
  };
  LensProvider.displayName = `${displayName}(Provider)`;

  return [lens, LensProvider] as const;
};

export const stateful = <S,>(initialState: S) => {
  const store = externalStore(initialState);
  const rootHandler = store({ keyPath: [], lens: basicLens() });

  const lens = initProxyLens<S>((focus) => {
    const debugValue = keyPathToString(focus.keyPath);
    const handler = store(focus);

    /**
     * Explicitly name the function here so that it shows up nicely in React Devtools.
     */
    return function useStatefulLensState(shouldUpdate) {
      React.useDebugValue(debugValue);

      return useExternalStoreHandler(handler, shouldUpdate);
    };
  });

  const ref: React.MutableRefObject<S> = {
    get current() {
      return rootHandler.getSnapshot();
    },
    set current(next) {
      rootHandler.update(() => next);
    },
  };

  return [lens, ref] as const;
};

export const useStateful = <S,>(initialState: S) => React.useMemo(() => stateful<S>(initialState), []);
