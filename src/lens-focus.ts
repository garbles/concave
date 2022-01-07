import { basicLens, BasicLens, prop } from "./basic-lens";
import { Key } from "./types";

export type LensFocus<S, A> = {
  keyPath: Key[];
  lens: BasicLens<S, A>;
};

export function refineLensFocus<S, A, K1 extends keyof A>(focus: LensFocus<S, A>, keys: [K1]): LensFocus<S, A[K1]>;

export function refineLensFocus<S, A, K1 extends keyof A, K2 extends keyof A[K1]>(
  focus: LensFocus<S, A>,
  keys: [K1, K2]
): LensFocus<S, A[K1][K2]>;

export function refineLensFocus<S, A, K1 extends keyof A, K2 extends keyof A[K1], K3 extends keyof A[K1][K2]>(
  focus: LensFocus<S, A>,
  keys: [K1, K2, K3]
): LensFocus<S, A[K1][K2][K3]>;

export function refineLensFocus(focus: LensFocus<any, any>, keys: Key[]): LensFocus<any, any> {
  const keyPath = [...focus.keyPath, ...keys];
  let lens = focus.lens;

  for (const key of keys) {
    lens = prop(lens, key);
  }

  return { keyPath, lens };
}

export const rootLensFocus = <S>(): LensFocus<S, S> => {
  return {
    keyPath: [],
    lens: basicLens(),
  };
};
