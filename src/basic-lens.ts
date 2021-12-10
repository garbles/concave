import { shallowCopy } from "./shallow-copy";

export type BasicLens<S, A> = {
  get(state: S): A;
  set(state: S, value: A): S;
};

const identity: BasicLens<any, any> = Object.freeze({
  get(state) {
    return state;
  },
  set(state, value) {
    return value;
  },
});

export const createBasicLens = <S>(): BasicLens<S, S> => identity;

export const refine = <S extends {}, A, B>(
  lens: BasicLens<S, A>,
  get: (value: A) => B,
  set: (state: A, value: B) => A
): BasicLens<S, B> => {
  return {
    get(state) {
      const prev = lens.get(state);
      const next = get(prev);

      return next;
    },

    set(state, value) {
      const prev = lens.get(state);
      const next = set(prev, value);

      return lens.set(state, next);
    },
  };
};

export const prop = <S extends {}, A extends {}, K extends keyof A>(
  sa: BasicLens<S, A>,
  key: K
): BasicLens<S, A[K]> => {
  return refine(
    sa,
    (state) => state[key],
    (prev, next) => {
      const copy = shallowCopy(prev);
      copy[key] = next;

      return copy;
    }
  );
};
