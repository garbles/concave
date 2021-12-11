import React from "react";
import { Context, createContext, useContextSelector } from "use-context-selector";
import { createProxyLens } from "./proxy";
import { createBasicLens, BasicLens } from "./basic-lens";

type Setter<S> = (fn: (state: S) => S) => void;
type Nothing = typeof nothing;

const nothing = Symbol();
const noop = () => {};

const useContextSelectorOrThrow = <T, U>(context: Context<T | Nothing>, fn: (value: T) => U): U => {
  return useContextSelector(context, (value) => {
    if (value === nothing) {
      throw new Error("Expected lens.use() or lens.useMap(...) to be used inside LensProvider");
    }

    return fn(value);
  });
};

export const create = <S,>() => {
  const StateContext = createContext<S | Nothing>(nothing);
  StateContext.displayName = "Lens(StateContext)";

  const SetStateContext = createContext<Setter<S> | Nothing>(nothing);
  SetStateContext.displayName = "Lens(SetStateContext)";

  const createUseState =
    <A,>(lens: BasicLens<S, A>) =>
    () => {
      const state = useContextSelectorOrThrow(StateContext, lens.get);

      let setterRef = React.useRef<Setter<S>>(noop);
      const setState = React.useCallback((next: A) => setterRef.current((state) => lens.set(state, next)), []);

      useContextSelectorOrThrow(SetStateContext, (fn) => {
        /**
         * Never re-render because the setState callback changes
         */
        setterRef.current = fn;
        return 0;
      });

      return [state, setState] as const;
    };

  const rawLens = createBasicLens<S>();
  const lens = createProxyLens({ lens: rawLens, createUseState });

  type LensProviderProps = {
    value: S;
    onChange(next: S): void;
  };

  const reducer = (state: S, set: (state: S) => S) => set(state);

  interface ILensProvider extends React.FC<LensProviderProps> {
    Stateful: typeof StatefulLensProvider;
  }

  const LensProvider: ILensProvider = (props) => {
    /**
     * Use a reducer to ensure that updates are scheduled correctly with React.
     */
    const [state, dispatch] = React.useReducer(reducer, props.value);

    /**
     * Run this effect only if state has changed.
     */
    React.useLayoutEffect(() => {
      if (Object.is(state, props.value)) {
        return;
      }

      props.onChange(state);
    }, [state]);

    /**
     * Run this effect only if props.value has changed.
     */
    React.useLayoutEffect(() => {
      if (Object.is(state, props.value)) {
        return;
      }

      dispatch(() => props.value);
    }, [props.value]);

    return (
      <StateContext.Provider value={state}>
        <SetStateContext.Provider value={dispatch}>{props.children}</SetStateContext.Provider>
      </StateContext.Provider>
    );
  };
  LensProvider.displayName = "Lens(Provider)";

  type StatefulLensProviderProps = React.PropsWithChildren<{
    initialValue: S;
  }>;

  type LensStateRef = {
    state: S;
  };

  // attach as LensProvider.Stateful
  const StatefulLensProvider = React.forwardRef<LensStateRef, StatefulLensProviderProps>((props, ref) => {
    const [state, setState] = React.useState(props.initialValue);

    React.useImperativeHandle(ref, () => ({ state }), [state]);

    return (
      <LensProvider value={state} onChange={setState}>
        {props.children}
      </LensProvider>
    );
  });
  StatefulLensProvider.displayName = "Lens(StatefulLensProvider)";

  LensProvider.Stateful = StatefulLensProvider;

  return {
    lens,
    LensProvider,
  };
};
