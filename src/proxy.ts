import { BasicLens, prop, coalesce } from "./basic-lens";

const PROXY_VALUE = Symbol();
const TO_LENS = Symbol();

type AnyObject = { [key: string | symbol | number]: JSON };
type AnyArray = JSON[];
type AnyPrimitive = number | bigint | string | boolean | null | void | symbol;
type JSON = AnyArray | AnyObject | AnyPrimitive;

type SetState<A> = (next: A) => void;
type UseState<A> = () => readonly [A, SetState<A>];
type ProxyUseState<A> = () => readonly [MaybeProxyValue<A>, SetState<A>];
type CreateUseState<S> = <A>(lens: BasicLens<S, A>) => UseState<A>;

type LensFixtures<S, A> = {
  lens: BasicLens<S, A>;
  createUseState: CreateUseState<S>;
};

type MaybeProxyValue<A> = A extends AnyPrimitive ? A : ProxyValue<A>;

type BaseProxyValue<A> = {
  toLens(): ProxyLens<A>;
};

type ArrayProxyValue<A extends AnyArray> = BaseProxyValue<A> & Array<ProxyValue<A[number]>>;
type ObjectProxyValue<A extends AnyObject> = BaseProxyValue<A> & { [K in keyof A]: ProxyValue<A[K]> };

// prettier-ignore
type ProxyValue<A> =
  A extends AnyArray ? ArrayProxyValue<A> :
  A extends AnyObject ? ObjectProxyValue<A> :
  A extends AnyPrimitive ? A :
  never;

type BaseProxyLens<A> = {
  useState: ProxyUseState<A>;
  coalesce(fallback: NonNullable<A>): ProxyLens<NonNullable<A>>;
  [TO_LENS](): ProxyLens<A>;
};

type ArrayProxyLens<A extends AnyArray> = BaseProxyLens<A> & Array<ProxyLens<A[number]>>;
type ObjectProxyLens<A extends AnyObject> = BaseProxyLens<A> & { [K in keyof A]: ProxyLens<A[K]> };
type PrimitiveProxyLens<A extends AnyPrimitive> = BaseProxyLens<A>;

// prettier-ignore
export type ProxyLens<A> =
  A extends AnyArray ? ArrayProxyLens<A> :
  A extends AnyObject ? ObjectProxyLens<A> :
  A extends AnyPrimitive ? PrimitiveProxyLens<A> :
  never;

// invert this to proxyable instead
type Unproxyable = AnyPrimitive | ((...args: any[]) => any) | Function;
const unproxyable = ["number", "bigint", "string", "boolean", "undefined", "symbol", "function"];
const isUnproxyable = (obj: unknown): obj is Unproxyable => obj === null || unproxyable.includes(typeof obj);

const createUseState = <S, A>(fixtures: LensFixtures<S, A>, lens: ProxyLens<A>): ProxyUseState<A> => {
  const cache = new WeakMap<any, ProxyValue<A>>();
  const useState = fixtures.createUseState(fixtures.lens);

  return () => {
    const [state, setState] = useState();

    if (isUnproxyable(state)) {
      return [state, setState] as [MaybeProxyValue<A>, SetState<A>];
    }

    // TODO: attach directly to the value
    let cached = cache.get(state);

    if (!cached) {
      cached = createProxyValue<A>(state, lens);
      cache.set(state, cached);
    }

    return [cached, setState] as [MaybeProxyValue<A>, SetState<A>];
  };
};

const createCoalesce =
  <S, A>(fixtures: LensFixtures<S, A>) =>
  (fallback: NonNullable<A>): ProxyLens<NonNullable<A>> => {
    const nextFixtures = {
      ...fixtures,
      lens: coalesce(fixtures.lens, fallback),
    };

    return createProxyLens(nextFixtures);
  };

// TODO: attach directly to the value
const valueCache: WeakMap<any, ProxyValue<any>> = new WeakMap();

const createProxyValue = <A extends {}>(obj: A, lens: ProxyLens<A>): ProxyValue<A> => {
  return new Proxy<A>(obj, {
    get(target, key) {
      if (key === "toLens") {
        return lens[TO_LENS];
      }

      const value = target[key as keyof A];

      if (isUnproxyable(value)) {
        return value;
      } else {
        if ((value as any)[PROXY_VALUE]) {
        }

        let cached = valueCache.get(value);

        if (!cached) {
          const nextLens = (lens as ObjectProxyLens<A>)[key as keyof A];
          cached = createProxyValue(value, nextLens as any);
          valueCache.set(value, cached);
        }

        return cached;
      }
    },
  }) as ProxyValue<A>;
};

// useState cache?
// proxyCache?

export const createProxyLens = <S, A>(fixtures: LensFixtures<S, A>): ProxyLens<A> => {
  type LensCache = { [K in keyof A]?: ProxyLens<A[K]> };
  const lensCache: LensCache = {};

  let useState: unknown;
  let coalesce: unknown;
  let toLens: unknown;

  const proxy = new Proxy(
    {},
    {
      get(_target, key) {
        if (key === TO_LENS) {
          toLens ??= () => proxy;
          return toLens;
        }

        if (key === "useState") {
          useState ??= createUseState(fixtures, proxy);
          return useState;
        }

        if (key === "coalesce") {
          coalesce ??= createCoalesce(fixtures);
          return coalesce;
        }

        /**
         * Potential memory leak if the keys are unbounded
         * TODO: setup manual garbage collection.
         */
        if (lensCache[key as keyof A] === undefined) {
          const nextFixtures = {
            ...fixtures,
            lens: prop(fixtures.lens, key as keyof A),
          };

          const nextProxy = createProxyLens(nextFixtures);
          lensCache[key as keyof A] = nextProxy;
        }

        return lensCache[key as keyof A];
      },
    }
  ) as ProxyLens<A>;

  return proxy;
};
