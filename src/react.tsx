/// <reference types="react/next" />

import React from "react";
import { basicLens, BasicLens } from "./basic-lens";
import { externalStore, ExternalStore } from "./external-store";
import { proxyLens } from "./proxy-lens";
import { useSyncExternalStoreWithLens } from "./use-sync-external-store-with-lens";

type Nothing = typeof nothing;
const nothing = Symbol();

export const create = <S,>() => {
  const ExternalStoreContext = React.createContext<ExternalStore<S> | Nothing>(nothing);
  ExternalStoreContext.displayName = "Lens(ExternalStoreContext)";

  const createUse =
    <A,>(lens: BasicLens<S, A>) =>
    (shouldUpdate?: (prev: A, next: A) => boolean) => {
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
      storeRef.current = externalStore(props.value);
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
