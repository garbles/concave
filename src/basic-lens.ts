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

export const basicLens = <S>(): BasicLens<S, S> => identity;

export const refine = <S extends {}, A, B>(
  lens: BasicLens<S, A>,
  get: (value: A) => B,
  set: (state: A, value: B) => A
): BasicLens<S, B> => {
  return {
    get(state) {
      const a = lens.get(state);
      return get(a);
    },

    set(state, b) {
      const a = lens.get(state);
      return lens.set(state, set(a, b));
    },
  };
};

export const prop = <S extends {}, A extends {}, K extends keyof A>(
  lens: BasicLens<S, A>,
  key: K
): BasicLens<S, A[K]> => {
  return refine(
    lens,
    (state) => state[key],
    (prev, next) => {
      const copy = shallowCopy(prev);
      copy[key] = next;

      return copy;
    }
  );
};
