/// <reference types="react/next" />

import React from "react";
import { createProxyLens } from "./proxy";
import { createBasicLens, BasicLens } from "./basic-lens";

type Nothing = typeof nothing;
type Listener = () => void;
type Unsubscribe = () => void;

type ExternalStore<S> = {
  subscribe(onStoreChange: Listener): Unsubscribe;
  getSnapshot(): S;
  apply(setter: (state: S) => S): void;
};

const nothing = Symbol();

const createExternalStore = <S,>(initialState: S): ExternalStore<S> => {
  const listeners = new Set<Listener>();
  let state = initialState;

  return {
    subscribe(sub) {
      listeners.add(sub);
      return () => listeners.delete(sub);
    },

    getSnapshot() {
      return state;
    },

    apply(set) {
      state = set(state);
      listeners.forEach((fn) => fn());
    },
  };
};

export const create = <S,>() => {
  const ExternalStoreContext = React.createContext<ExternalStore<S> | Nothing>(nothing);
  ExternalStoreContext.displayName = "Lens(ExternalStoreContext)";

  const createUseState =
    <A,>(lens: BasicLens<S, A>) =>
    () => {
      const store = React.useContext(ExternalStoreContext);

      if (store === nothing) {
        throw new Error("Cannot call `lens.use()` in a component outside of <LensProvider />");
      }

      const state = React.useSyncExternalStore(store.subscribe, () => lens.get(store.getSnapshot()));
      const setState = React.useCallback((next: A) => store.apply((s) => lens.set(s, next)), [store]);

      return [state, setState] as const;
    };

  const rawLens = createBasicLens<S>();
  const lens = createProxyLens({ lens: rawLens, createUseState });

  type LensProviderProps = {
    value: S;
    onChange(next: S): void;
  };

  interface ILensProvider extends React.FC<LensProviderProps> {
    Stateful: typeof StatefulLensProvider;
  }

  const LensProvider: ILensProvider = (props) => {
    const storeRef = React.useRef<ExternalStore<S>>();
    if (!storeRef.current) {
      storeRef.current = createExternalStore(props.value);
    }
    let store = storeRef.current;

    React.useEffect(() => {
      if (store.getSnapshot() !== props.value) {
        store.apply(() => props.value);
      }
    }, [props.value]);

    React.useEffect(() => {
      return store.subscribe(() => props.onChange(store.getSnapshot()));
    }, [props.onChange]);

    return <ExternalStoreContext.Provider value={store}>{props.children}</ExternalStoreContext.Provider>;
  };
  LensProvider.displayName = "Lens(Provider)";

  type StatefulLensProviderProps = React.PropsWithChildren<{
    initialValue: S;
  }>;

  type LensStateRef = {
    state: S;
  };

  const StatefulLensProvider = React.forwardRef<LensStateRef, StatefulLensProviderProps>((props, ref) => {
    const [state, setState] = React.useState(props.initialValue);

    React.useImperativeHandle(ref, () => ({ state }), [state]);

    return (
      <LensProvider value={state} onChange={setState}>
        {props.children}
      </LensProvider>
    );
  });
  StatefulLensProvider.displayName = "Lens(StatefulProvider)";
  LensProvider.Stateful = StatefulLensProvider;

  return {
    lens,
    LensProvider,
  };
};
