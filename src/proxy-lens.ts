import { basicLens, BasicLens, prop } from "./basic-lens";
import { isObject } from "./is-object";
import { keyPathToString } from "./key-path-to-string";
import { ReactDevtools } from "./react-devtools";
import { ShouldUpdate } from "./should-update";

type Key = string | number | symbol;
type AnyObject = { [key: string | number | symbol]: JSON };
type AnyArray = JSON[];
type AnyPrimitive = number | bigint | string | boolean | null | void | symbol;
type JSON = AnyArray | AnyObject | AnyPrimitive;
type Proxyable = AnyArray | AnyObject;

type LensFocus<S, A> = {
  lens: BasicLens<S, A>;
  keyPath: Key[];
};

type Updater<A> = (a: A) => A;
type Update<A> = (updater: Updater<A>) => void;
type UseLensState<A> = (shouldUpdate?: ShouldUpdate<A>) => readonly [A, Update<A>];
type UseLensProxy<A> = (shouldUpdate?: ShouldUpdate<A>) => readonly [ProxyValue<A>, Update<A>];
type CreateUseLensState<S> = <A>(focus: LensFocus<S, A>) => UseLensState<A>;

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
   * Collapses the `ProxyLens<A>` into a `ProxyValue<A>`.
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
  [WRAP_IN_FUNC](): ProxyLens<A>;
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
const WRAP_IN_FUNC = Symbol();
const THROW_ON_COPY = Symbol();

const isProxyable = (obj: any): obj is Proxyable => Array.isArray(obj) || isObject(obj);

const focusProp = <S, A>(focus: LensFocus<S, A>, key: keyof A): LensFocus<S, A[keyof A]> => {
  return {
    keyPath: [...focus.keyPath, key],
    lens: prop(focus.lens, key as keyof A),
  };
};

const createUseLensProxy = <S, A>(
  createUseLensState: CreateUseLensState<S>,
  focus: LensFocus<S, A>,
  lens: ProxyLens<A>
): UseLensProxy<A> => {
  const useLensState = createUseLensState(focus);

  /**
   * Explicitly name the function here so that it shows up nicely in React Devtools.
   */
  return function useLens(shouldUpdate) {
    const [state, setState] = useLensState(shouldUpdate);
    const next = proxyValue(state, lens);

    return [next, setState];
  };
};

const proxyValue = <A>(obj: A, lens: ProxyLens<A>): ProxyValue<A> => {
  if (!isProxyable(obj)) {
    return obj as ProxyValue<A>;
  }

  /**
   * Reuse the proxy if one already exists on the source value.
   * `PROXY_VALUE` will be stripped from the `obj`
   * if `shallowCopy` is called on it.
   */
  if (Reflect.has(obj, PROXY_VALUE)) {
    return Reflect.get(obj, PROXY_VALUE);
  }

  let toJSON: unknown;

  const proxy = new Proxy(obj, {
    get(target, key) {
      if (key === "toJSON") {
        toJSON ??= () => target;
        return toJSON;
      }

      if (key === "toLens") {
        return lens[WRAP_IN_FUNC];
      }

      if (key === PROXY_VALUE) {
        return proxy;
      }

      const nextValue = target[key as keyof A];
      const nextLens = (lens as any)[key];

      return proxyValue(nextValue, nextLens);
    },

    ownKeys(target) {
      return Reflect.ownKeys(target).concat(["toLens", "toJSON"]);
    },

    getOwnPropertyDescriptor(target, key) {
      /**
       * Get the property descriptor for this `key`.
       */
      let desc: PropertyDescriptor | undefined;

      /**
       * If the key is one of the special ProxyValue keys,
       * set the property descriptor to a custom value.
       */
      if (key === "toLens" || key === "toJSON") {
        desc = {
          configurable: true,
          enumerable: true,
          writable: false,
        };
        /**
         * Otherwise look it up on the target.
         */
      } else {
        desc = Object.getOwnPropertyDescriptor(target, key);
      }

      /**
       * Now bail if the descriptor is `undefined`. This could only
       * occur if the key is not `'toLens' | 'toJSON' | keyof A`.
       */
      if (desc === undefined) {
        return;
      }

      /**
       * Defer the actual value to the proxy so that
       * it gets wrapped in another proxy.
       */
      const value = (proxy as any)[key];

      return {
        writable: desc.writable,
        enumerable: desc.enumerable,
        configurable: desc.configurable,
        value,
      };
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
    writable: false,
    configurable: false,
  });

  return proxy;
};

const proxyLens = <S, A>(createUseLensState: CreateUseLensState<S>, focus: LensFocus<S, A>): ProxyLens<A> => {
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
         * Block React introspection as it will otherwise produce an infinite chain of
         * ProxyLens values in React Devtools.
         */
        if (key === "$$typeof") {
          return undefined;
        }

        if (key === "$key") {
          $key ??= keyPathToString(focus.keyPath);
          return $key;
        }

        /**
         * This is attached to the proxy because the proxy never changes.
         * So even if the underlying data changes, the `ProxyValue` wrapping
         * it will always refer to the same `toLens` function.
         */
        if (key === WRAP_IN_FUNC) {
          toLens ??= () => proxy;
          return toLens;
        }

        if (key === "use") {
          use ??= createUseLensProxy(createUseLensState, focus, proxy);
          return use;
        }

        if (cache[key as keyof A] === undefined) {
          const nextFocus = focusProp(focus, key as keyof A);
          const nextProxy = proxyLens(createUseLensState, nextFocus);
          cache[key as keyof A] = nextProxy;
        }

        return cache[key as keyof A];
      },

      ownKeys(_target) {
        return ["$key", "use", THROW_ON_COPY];
      },

      getOwnPropertyDescriptor(_target, key) {
        if (key === "$key" || key === "use") {
          return {
            configurable: true,
            enumerable: true,
            writable: false,
            value: proxy[key as keyof ProxyLens<A>],
          };
        }

        /**
         * This is a hack to ensure that when React Devtools is
         * reading all of the props with `getOwnPropertyDescriptors`
         * it does not throw an error.
         */
        if (ReactDevtools.isCalledInsideReactDevtools()) {
          return {
            configurable: true,
            enumerable: false,
            value: undefined,
          };
        }

        /**
         * We otherwise do not want the lens to be introspected with `Object.getOwnPropertyDescriptors`
         * which will happen internally with `{ ...lens }` or `Object.assign({}, lens)`.
         * Both of those operations will create a new plain object from the properties that it can retrieve
         * off of the lens; however, the lens is a shell around nothing and relies _heavily_ on TypeScript
         * telling the developer which attributes are available. Therefore, copying the lens will leave you
         * with an object that only has `$key` and `use`. Accessing `lens.user`, for example, will be
         * `undefined` and will not be caught by TypeScript because the Proxy is typed as `A & { $key, use }`.
         *
         * If we've reached here, we are trying to access the property descriptor for `THROW_ON_COPY`,
         * which is not a real property on the lens, so just throw.
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

export const initProxyLens = <S>(createUseLensState: CreateUseLensState<S>): ProxyLens<S> =>
  proxyLens(createUseLensState, { lens: basicLens(), keyPath: [] });
