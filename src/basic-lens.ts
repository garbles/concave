import { shallowCopy } from "./shallow-copy";

type Updater<A> = (a: A) => A;

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

const refine = <S extends {}, A, B>(
  lens: BasicLens<S, A>,
  get: (a: A) => B,
  set: (a: A, b: B) => A
): BasicLens<S, B> => {
  return {
    get(s) {
      const a = lens.get(s);
      return get(a);
    },

    set(s, b) {
      const a = lens.get(s);
      return lens.set(s, set(a, b));
    },
  };
};

export const prop = <S extends {}, A extends {}, K extends keyof A>(
  lens: BasicLens<S, A>,
  key: K
): BasicLens<S, A[K]> => {
  return refine(
    lens,
    (s) => s[key],
    (a, ak) => {
      const copy = shallowCopy(a);
      copy[key] = ak;

      return copy;
    }
  );
};

export const update =
  <S, A>(lens: BasicLens<S, A>, updater: Updater<A>) =>
  (s: S): S => {
    const a = lens.get(s);
    return lens.set(s, updater(a));
  };
