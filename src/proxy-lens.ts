import { BasicLens, prop } from "./basic-lens";
import { isObject } from "./is-object";
import { ReactDevtools } from "./react-devtools";
import { ShouldUpdate } from "./should-update";

type Key = string | number | symbol;
type AnyObject = { [key: Key]: JSON };
type AnyArray = JSON[];
type AnyPrimitive = number | bigint | string | boolean | null | void | symbol;
type JSON = AnyArray | AnyObject | AnyPrimitive;
type Proxyable = AnyArray | AnyObject;

type Updater<A> = (a: A) => A;
type Update<A> = (updater: Updater<A>) => void;
type UseLens<A> = (shouldUpdate?: ShouldUpdate<A>) => readonly [A, Update<A>];
type UseLensProxy<A> = (shouldUpdate?: ShouldUpdate<A>) => readonly [ProxyValue<A>, Update<A>];
type CreateUseLens<S> = <A>(lens: BasicLens<S, A>) => UseLens<A>;

type LensFixtures<S, A> = {
  lens: BasicLens<S, A>;
  createUseLens: CreateUseLens<S>;
  meta: { keyPath: Key[] };
};

type BaseProxyValue<A> = {
  toJSON(): A;
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
  /**
   * Collapses the `ProxyLens` into a `ProxyValue`.
   */
  use: UseLensProxy<A>;
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
const THROW_ON_COPY = Symbol();

const isProxyable = (obj: any): obj is Proxyable => Array.isArray(obj) || isObject(obj);

const createUseLens = <S, A>(fixtures: LensFixtures<S, A>, lens: ProxyLens<A>): UseLensProxy<A> => {
  const use = fixtures.createUseLens(fixtures.lens);

  /**
   * Explicitly name the function here so that it shows up nicely in React Devtools.
   */
  return function useLens(shouldUpdate) {
    const [state, setState] = use(shouldUpdate);
    const next = proxyValue(state, lens);

    return [next, setState];
  };
};

const proxyValue = <A>(obj: A, lens: ProxyLens<A>): ProxyValue<A> => {
  if (!isProxyable(obj)) {
    return obj as ProxyValue<A>;
  }

  if (Reflect.has(obj, PROXY_VALUE)) {
    return Reflect.get(obj, PROXY_VALUE);
  }

  let toJSON: unknown;

  const proxy = new Proxy(obj, {
    get(target, key) {
      if (key === PROXY_VALUE) {
        return proxy;
      }

      if (key === "toJSON") {
        toJSON ??= () => target;
        return toJSON;
      }

      if (key === "toLens") {
        return lens[TO_LENS];
      }

      const nextValue = target[key as keyof A];
      const nextLens = (lens as any)[key];

      return proxyValue(nextValue, nextLens);
    },

    ownKeys(target) {
      return [...Reflect.ownKeys(target), "toLens", "toJSON"];
    },

    getOwnPropertyDescriptor(target, key) {
      if (key === PROXY_VALUE) {
        return {
          enumerable: false,
          value: proxy,
        };
      }

      return { configurable: true, enumerable: true, value: (proxy as any)[key] };
    },

    preventExtensions() {
      return true;
    },
    isExtensible() {
      return false;
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
    value: proxy,
    enumerable: false,
  });

  return proxy;
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
        /**
         * Block React introspection as it will otherwise produce an infinite chain of ProxyLens values.
         */
        if (key === "$$typeof") {
          return undefined;
        }

        if (key === "$key") {
          $key ??= `Lens(${fixtures.meta.keyPath.join(".")})`;
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
          use ??= createUseLens(fixtures, proxy);
          return use;
        }

        if (cache[key as keyof A] === undefined) {
          const nextFixtures: LensFixtures<S, A[keyof A]> = {
            ...fixtures,
            meta: {
              ...fixtures.meta,
              keyPath: [...fixtures.meta.keyPath, key],
            },
            lens: prop(fixtures.lens, key as keyof A),
          };

          const nextProxy = proxyLens(nextFixtures);
          cache[key as keyof A] = nextProxy;
        }

        return cache[key as keyof A];
      },

      ownKeys(target) {
        return ["$key", "use", THROW_ON_COPY];
      },

      getOwnPropertyDescriptor(target, key) {
        if (key === "$key" || key === "use") {
          return {
            configurable: true,
            enumerable: true,
            value: proxy[key as keyof ProxyLens<A>],
          };
        }

        /**
         * This is a hack to ensure that when React Devtools is
         * reading all of the props with `getOwnPropertyDescriptors`
         * it does not throw an error. We do not want the
         * lens to be copied via `{ ...lens }` or `Object.assign({}, lens)`
         * because it will break the type safety.
         */
        if (ReactDevtools.isCalledInsideReactDevtools()) {
          return {
            configurable: true,
            enumerable: false,
            value: undefined,
          };
        }

        /**
         * If we reached here, we are trying to access the property descriptor
         * for `THROW_ON_COPY`, so just throw.
         */
        throw new Error(
          "ProxyLens threw because you tried to access all property descriptors—probably through " +
            "`{ ...lens }` or `Object.assign({}, lens)`. Doing this will break the type safety offered by " +
            "this library so it is forbidden. Sorry, buddy pal."
        );
      },

      getPrototypeOf() {
        return null;
      },
      preventExtensions() {
        return true;
      },
      isExtensible() {
        return false;
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
