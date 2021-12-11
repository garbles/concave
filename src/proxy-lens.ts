import { BasicLens, prop } from "./basic-lens";
import { isObject } from "./is-object";

type AnyObject = { [key: string | symbol | number]: JSON };
type AnyArray = JSON[];
type AnyPrimitive = number | bigint | string | boolean | null | void | symbol;
type JSON = AnyArray | AnyObject | AnyPrimitive;
type Proxyable = AnyArray | AnyObject;

type SetNext<A> = (next: A) => void;
type Use<A> = () => readonly [A, SetNext<A>];
type UseProxy<A> = () => readonly [MaybeProxyValue<A>, SetNext<A>];
type CreateUse<S> = <A>(lens: BasicLens<S, A>) => Use<A>;

type LensFixtures<S, A> = {
  lens: BasicLens<S, A>;
  createUse: CreateUse<S>;
};

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

type MaybeProxyValue<A> = A extends Proxyable ? ProxyValue<A> : A;

type BaseProxyLens<A> = {
  /**
   * Collapses the `ProxyLens` into a `ProxyValue`.
   */
  use: UseProxy<A>;
  /**
   * A unique key for cases when you need a key. e.g. A React list.
   *
   * @example
   * const [list] = state.use();
   *
   * list.map(value => {
   *   const lens = value.toLens();
   *
   *   return <ListItem key={lens.$key} state={lens} />;
   * });
   */
  $key: string;
  /**
   * Internal. Only called by `ProxyValue#toLens`.
   */
  [TO_LENS](): ProxyLens<A>;
};

type ArrayProxyLens<A extends AnyArray> = BaseProxyLens<A> & { [K in number]: ProxyLens<A[K]> };
type ObjectProxyLens<A extends AnyObject> = BaseProxyLens<A> & { [K in keyof A]: ProxyLens<A[K]> };
type PrimitiveProxyLens<A extends AnyPrimitive> = BaseProxyLens<A>;

// prettier-ignore
export type ProxyLens<A> =
  A extends AnyArray ? ArrayProxyLens<A> :
  A extends AnyObject ? ObjectProxyLens<A> :
  A extends AnyPrimitive ? PrimitiveProxyLens<A> :
  never;

const PROXY_VALUE = Symbol();
const TO_LENS = Symbol();

let keyCounter = 0;
const proxyLensKey = () => `$$ProxyLens(${keyCounter++})`;

const isProxyable = (obj: any): obj is Proxyable => Array.isArray(obj) || isObject(obj);

const createUseState = <S, A>(fixtures: LensFixtures<S, A>, lens: ProxyLens<A>): UseProxy<A> => {
  const useState = fixtures.createUse(fixtures.lens);

  return () => {
    const [state, setState] = useState();
    const next = maybeProxyValue(state, lens);

    return [next, setState];
  };
};

const maybeProxyValue = <A>(obj: A, lens: ProxyLens<A>): MaybeProxyValue<A> => {
  if (!isProxyable(obj)) {
    return obj as MaybeProxyValue<A>;
  }

  if (Reflect.has(obj, PROXY_VALUE)) {
    return Reflect.get(obj, PROXY_VALUE);
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

      return maybeProxyValue(nextValue, nextLens);
    },
    set() {
      throw new Error("Cannot set property on ProxyValue");
    },
    deleteProperty() {
      throw new Error("Cannot delete property on ProxyValue");
    },
  }) as ProxyValue<A>;

  /**
   * Do not allow `PROXY_VALUE` to be enumerable so that:
   *
   * 1. Creating a shallow copy `{ ...obj }` will ignore it. This ensures the
   *    proxy value is forgotten when the actual value changes.
   * 2. It is not accessible outside of this module.
   */
  Object.defineProperty(obj, PROXY_VALUE, {
    get() {
      return proxy;
    },
    enumerable: false,
  });

  return proxy as MaybeProxyValue<A>;
};

export const proxyLens = <S, A>(fixtures: LensFixtures<S, A>): ProxyLens<A> => {
  type LensCache = { [K in keyof A]?: ProxyLens<A[K]> };
  const cache: LensCache = {};

  let use: unknown;
  let toLens: unknown;
  let $key: unknown;

  const proxy = new Proxy(
    {},
    {
      get(_target, key) {
        if (key === "$key") {
          $key ??= proxyLensKey();
          return $key;
        }

        /**
         * This is attached to the proxy because the proxy never changes.
         * So even if the underlying data changes, the `ProxyValue` wrapping
         * it will always refer to the same `toLens` function.
         */
        if (key === TO_LENS) {
          toLens ??= () => proxy;
          return toLens;
        }

        if (key === "use") {
          use ??= createUseState(fixtures, proxy);
          return use;
        }

        if (cache[key as keyof A] === undefined) {
          const nextFixtures = {
            ...fixtures,
            lens: prop(fixtures.lens, key as keyof A),
          };

          const nextProxy = proxyLens(nextFixtures);
          cache[key as keyof A] = nextProxy;
        }

        return cache[key as keyof A];
      },
      set() {
        throw new Error("Cannot set property on ProxyLens");
      },
      deleteProperty() {
        throw new Error("Cannot delete property on ProxyLens");
      },
    }
  ) as ProxyLens<A>;

  return proxy;
};
