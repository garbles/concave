import { shallowCopy } from "./shallow-copy";

export type RawLens<S, A> = {
  get(state: S): A;
  set(state: S, value: A): S;
};

const identity: RawLens<any, any> = Object.freeze({
  get(state) {
    return state;
  },
  set(state, value) {
    return value;
  },
});

export const createRawLens = <S>(): Readonly<RawLens<S, S>> => identity;

export const refine = <S extends {}, A, B>(
  lens: RawLens<S, A>,
  get: (value: A) => B,
  set: (state: A, value: B) => A
): Readonly<RawLens<S, B>> => {
  return Object.freeze({
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
  });
};

export const prop = <S extends {}, A, K extends keyof A>(sa: RawLens<S, A>, key: K): Readonly<RawLens<S, A[K]>> => {
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

export const compose = <S extends {}, A, B>(sa: RawLens<S, A>, ab: RawLens<A, B>): RawLens<S, B> => {
  return refine(sa, ab.get, ab.set);
};

export const tranverse = <S, A, B>(sa: RawLens<S, A[]>, ab: RawLens<A | void, B>): RawLens<S, B[]> => {
  return {
    get(state) {
      const a = sa.get(state);
      return a.map(ab.get);
    },

    set(state, next) {
      const prev = sa.get(state);
      const result: A[] = [];
      const len = Math.max(prev.length, next.length);

      for (let i = 0; i < len; i++) {
        const a = prev[i];
        const b = next[i];

        if (b === undefined) {
          break;
        }

        const value = ab.set(a, b);

        if (value === undefined) {
          break;
        }

        result.push(value);
      }

      return sa.set(state, result);
    },
  };
};
