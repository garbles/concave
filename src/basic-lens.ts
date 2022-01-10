import { shallowCopy } from "./shallow-copy";

export type BasicLens<S, A> = {
  get(s: S): A;
  set(s: S, a: A): S;
};

const identity: BasicLens<any, any> = Object.freeze({
  get(s) {
    return s;
  },
  set(s, a) {
    return a;
  },
});

export const basicLens = <S>(): BasicLens<S, S> => identity;

export const prop = <S extends {}, A extends {}, K extends keyof A>(
  lens: BasicLens<S, A>,
  key: K
): BasicLens<S, A[K]> => {
  return {
    get(s) {
      const a = lens.get(s);
      return a[key];
    },

    set(s, b) {
      const a = lens.get(s);
      const copy = shallowCopy(a);
      copy[key] = b;

      return lens.set(s, copy);
    },
  };
};
