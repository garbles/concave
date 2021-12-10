import { BasicLens, prop, coalesce } from "./basic-lens";
import { isObject } from "./is-object";

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
  $key: string;
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

let keyCounter = 0;
const proxyLensKey = () => `ProxyLens(${keyCounter++})`;

const isProxyable = (obj: any): obj is AnyArray | AnyObject => Array.isArray(obj) || isObject(obj);

const createUseState = <S, A>(fixtures: LensFixtures<S, A>, lens: ProxyLens<A>): ProxyUseState<A> => {
  const useState = fixtures.createUseState(fixtures.lens);

  return () => {
    const [state, setState] = useState();
    const next = createMaybeProxyValue(state, lens);

    return [next, setState];
  };
};

const createCoalesce = <S, A>(fixtures: LensFixtures<S, A>) => {
  (fallback: NonNullable<A>): ProxyLens<NonNullable<A>> => {
    const nextFixtures = {
      ...fixtures,
      lens: coalesce(fixtures.lens, fallback),
    };

    return createProxyLens(nextFixtures);
  };
};

const createMaybeProxyValue = <A>(obj: A, lens: ProxyLens<A>): MaybeProxyValue<A> => {
  if (!isProxyable(obj)) {
    return obj as MaybeProxyValue<A>;
  }

  if ((obj as any)[PROXY_VALUE]) {
    return (obj as any)[PROXY_VALUE];
  }

  const proxy = new Proxy(obj, {
    get(target, key) {
      if (key === PROXY_VALUE) {
        return proxy;
      }

      if (key === "toLens") {
        return lens[TO_LENS];
      }

      const nextValue = target[key as keyof A];
      const nextLens = (lens as any)[key];

      return createMaybeProxyValue(nextValue, nextLens);
    },
  }) as ProxyValue<A>;

  (obj as any)[PROXY_VALUE] = proxy;

  return proxy as MaybeProxyValue<A>;
};

export const createProxyLens = <S, A>(fixtures: LensFixtures<S, A>): ProxyLens<A> => {
  type LensCache = { [K in keyof A]?: ProxyLens<A[K]> };
  const cache: LensCache = {};
  const $key = proxyLensKey();

  let useState: unknown;
  let coalesce: unknown;
  let toLens: unknown;

  const proxy = new Proxy(
    {},
    {
      get(_target, key) {
        if (key === "$key") {
          return $key;
        }

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

        if (cache[key as keyof A] === undefined) {
          const nextFixtures = {
            ...fixtures,
            lens: prop(fixtures.lens, key as keyof A),
          };

          const nextProxy = createProxyLens(nextFixtures);
          cache[key as keyof A] = nextProxy;
        }

        return cache[key as keyof A];
      },
    }
  ) as ProxyLens<A>;

  return proxy;
};
