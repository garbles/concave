import React from "react";
import { createProxyLens, ProxyLens } from "../src/proxy";
import { createBasicLens, BasicLens } from "../src/basic-lens";

type Dispatcher = () => void;

type Result<S> = {
  lens: ProxyLens<S>;
  ref: React.RefObject<S>;
};

export const createTestLens = <S>(initialState: S): Result<S> => {
  const rawLens = createBasicLens<S>();
  const dispatchers: Set<Dispatcher> = new Set();

  let globalState = initialState;

  const createSetState =
    <A>(lens: BasicLens<S, A>) =>
    () => {
      const [next, dispatch] = React.useReducer(() => globalState, globalState);

      React.useEffect(() => {
        dispatchers.add(dispatch);

        return () => {
          dispatchers.delete(dispatch);
        };
      }, [dispatch]);

      const state = lens.get(next);

      const setState = React.useCallback(
        (a: A): void => {
          globalState = lens.set(globalState, a);
          dispatchers.forEach((d) => d());
        },
        [lens]
      );

      return [state, setState] as const;
    };

  return {
    lens: createProxyLens(rawLens, createSetState),

    ref: {
      get current() {
        return globalState;
      },
    },
  };
};
