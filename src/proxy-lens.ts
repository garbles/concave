import { compose, prop, tranverse, RawLens, coalesce } from "./raw-lens";

type SetState<A> = (next: A) => void;

type UseState<A> = () => readonly [A, SetState<A>];

type UseMap<A extends any[]> = <T>(
  fn: (lens: ProxyLens<A[number]>, value: A[number], index: number, arr: A) => T
) => T[];

type CreateUseState<S> = <A>(lens: RawLens<S, A>) => UseState<A>;

type WithUseState<A> = {
  useState: UseState<A>;
  compose<B>(lens: RawLens<A, B>): ProxyLens<B>;
  coalesce(fallback: NonNullable<A>): ProxyLens<NonNullable<A>>;
};

type WithUseMap<A extends any[]> = {
  useMap: UseMap<A>;
  traverse<B>(ab: RawLens<A[number] | void, B>): ProxyLens<B[]>;
};

/**
 * The following types exist just so that TS server displays them nicely.
 */

type ArrayProxyLens<A extends any[]> = WithUseState<A> & WithUseMap<A> & { [K in number]: ProxyLens<A[K]> };

type ObjectProxyLens<A> = WithUseState<A> & { [K in keyof A]: ProxyLens<A[K]> };

type PrimitiveProxyLens<A> = WithUseState<A>;

// prettier-ignore
export type ProxyLens<A> =
  A extends any[] ? ArrayProxyLens<A> :
  A extends { [k: string]: any } ? ObjectProxyLens<A> :
  PrimitiveProxyLens<A>;

const createCompose =
  <S, A>(sa: RawLens<S, A>, createUseState: CreateUseState<S>) =>
  <B>(ab: RawLens<A, B>): Readonly<ProxyLens<B>> => {
    const lens = compose(sa, ab);
    return createProxyLens(lens, createUseState);
  };

const createCoalesce =
  <S, A>(sa: RawLens<S, A>, createUseState: CreateUseState<S>) =>
  (fallback: NonNullable<A>): Readonly<ProxyLens<NonNullable<A>>> => {
    const lens = coalesce(sa, fallback);
    return createProxyLens(lens, createUseState);
  };

const createUseMap =
  <A extends any[]>(lens: ArrayProxyLens<A>): UseMap<A> =>
  <B>(fn: (p: ProxyLens<A[keyof A]>, value: A[keyof A], index: number, arr: A) => B): B[] => {
    const [state] = lens.useState();
    return state.map((value, i) => fn(lens[i], value, i, state));
  };

const createTraverse =
  <S, A>(sa: RawLens<S, A[]>, createUseState: CreateUseState<S>) =>
  <B>(ab: RawLens<A | void, B>): Readonly<ProxyLens<B[]>> => {
    const lens: RawLens<S, B[]> = tranverse(sa, ab);
    return createProxyLens(lens, createUseState);
  };

export const createProxyLens = <S, A>(
  lens: RawLens<S, A>,
  createUseState: CreateUseState<S>
): Readonly<ProxyLens<A>> => {
  type KeyCache = { [K in keyof A]?: Readonly<ProxyLens<A[K]>> };

  let useState: unknown;
  let compose: unknown;
  let coalesce: unknown;
  let useMap: unknown;
  let traverse: unknown;
  const keyCache: KeyCache = {};

  const proxy = new Proxy({} as ProxyLens<A>, {
    get(_target, _key: string) {
      const key = _key as "useState" | "useMap" | "compose" | "coalesce" | "traverse" | keyof A;

      switch (key) {
        case "useState":
          if (useState === undefined) useState = createUseState(lens);
          return useState;

        case "compose":
          if (compose === undefined) compose = createCompose(lens, createUseState);
          return compose;

        case "coalesce":
          if (coalesce === undefined) coalesce = createCoalesce(lens, createUseState);
          return coalesce;

        case "useMap":
          if (useMap === undefined) useMap = createUseMap(proxy as ArrayProxyLens<any>);
          return useMap;

        case "traverse":
          if (traverse === undefined) traverse = createTraverse(lens as RawLens<any, any>, createUseState);
          return traverse;

        default:
          /**
           * Potential memory leak if the keys are unbounded
           * Need to setup manual garbage collection.
           */
          if (keyCache[key] === undefined) {
            const nextLens = prop(lens, key);
            const nextProxy = createProxyLens(nextLens, createUseState);
            keyCache[key] = nextProxy;
          }

          return keyCache[key];
      }
    },
  });

  return proxy;
};
