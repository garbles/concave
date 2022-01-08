import { Connection } from "./connection";
import { keyPathToString } from "./key-path-to-string";
import { LensFocus, refineLensFocus } from "./lens-focus";
import { ProxyValue } from "./proxy-value";
import { createUseLens } from "./react";
import { ReactDevtools } from "./react-devtools";
import { ShouldUpdate } from "./should-update";
import { createConnectionStoreFactory, Store } from "./store";
import { AnyArray, AnyConnection, AnyObject, AnyPrimitive, Update } from "./types";

type StoreFactory<S> = <A>(focus: LensFocus<S, A>) => Store<A>;

type BaseProxyLens<A> = {
  /**
   * Fetches the store for current focus.
   */
  getStore(): Store<A>;

  /**
   * Collapses the lens into a React hook.
   */
  use(shouldUpdate?: ShouldUpdate<A>): [ProxyValue<A>, Update<A>];
  /**
   * A unique key for cases when you need a key. e.g. A React list.
   *
   * @example
   * const [list] = useLens(state);
   *
   * list.map(value => {
   *   const lens = value.toLens();
   *
   *   return <ListItem key={lens.$key} state={lens} />;
   * });
   */
  $key: string;
};

type ConnectionProxyLens<A> = BaseProxyLens<A> &
  (A extends Connection<infer B, infer I> ? (input: I) => ProxyLens<B> : {});

type ArrayProxyLens<A extends AnyArray> = BaseProxyLens<A> & { [K in number]: ProxyLens<A[K]> };
type ObjectProxyLens<A extends AnyObject> = BaseProxyLens<A> & { [K in keyof A]: ProxyLens<A[K]> };
type PrimitiveProxyLens<A extends AnyPrimitive> = BaseProxyLens<A>;

// prettier-ignore
export type ProxyLens<A> =
  A extends AnyConnection ? ConnectionProxyLens<A> :
  A extends AnyObject ? ObjectProxyLens<A> :
  A extends AnyArray ? ArrayProxyLens<A> :
  A extends AnyPrimitive ? PrimitiveProxyLens<A> :
  never;

const THROW_ON_COPY = Symbol();
const specialKeys: (keyof BaseProxyLens<{}>)[] = ["use", "getStore", "$key"];
const functionTrapKeys = ["arguments", "caller", "prototype"];

export const proxyLens = <S, A>(storeFactory: StoreFactory<S>, focus: LensFocus<S, A>): ProxyLens<A> => {
  type KeyCache = { [K in keyof A]?: ProxyLens<A[K]> };
  type ConnectionCache = { [cacheKey: string]: A extends Connection<infer B, any> ? ProxyLens<B> : never };
  type Target = Partial<BaseProxyLens<A>>;

  let keyCache: KeyCache;
  let connectionCache: ConnectionCache;
  let $key: string;
  let use: (shouldUpdate?: ShouldUpdate<A>) => [ProxyValue<A>, Update<A>];
  let getStore: () => Store<A>;

  /**
   * Use a function here so that we can trick the Proxy into allowing us to use `apply`
   * for connections. This won't really impact performance for property access because `ProxyLens`
   * never actually accesses target properties. Further, constructing a function is slightly
   * slower than constructing an object, but it is only done once and then cached forever.
   */
  const target = function () {} as Target;

  const proxy = new Proxy(target, {
    apply(target, _thisArg, argsArray) {
      const connCache = (connectionCache ??= {});
      const [input] = argsArray;
      const cacheKey = JSON.stringify(input);
      let next = connCache[cacheKey];

      if (!next) {
        const [nextFactory, nextFocus] = createConnectionStoreFactory(storeFactory, focus as any, input);
        next = connCache[cacheKey] = proxyLens(nextFactory, nextFocus) as any;
      }

      return next;
    },

    get(target, key) {
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

      if (key === "use") {
        use ??= createUseLens(proxy);
        return use;
      }

      if (key === "getStore") {
        getStore ??= () => storeFactory(focus);
        return getStore;
      }

      keyCache ??= {};

      if (keyCache[key as keyof A] === undefined) {
        const nextFocus = refineLensFocus(focus, [key as keyof A]);
        const nextProxy = proxyLens(storeFactory, nextFocus);
        keyCache[key as keyof A] = nextProxy;
      }

      return keyCache[key as keyof A];
    },

    ownKeys(_target) {
      return [...specialKeys, ...functionTrapKeys, THROW_ON_COPY];
    },

    has(_target, key) {
      return specialKeys.includes(key as keyof BaseProxyLens<{}>);
    },

    getOwnPropertyDescriptor(target, key) {
      if (specialKeys.includes(key as keyof BaseProxyLens<{}>)) {
        return {
          configurable: true,
          enumerable: true,
          writable: false,
          value: proxy[key as keyof Partial<BaseProxyLens<A>>],
        };
      }

      if (functionTrapKeys.includes(key as keyof Target)) {
        return Reflect.getOwnPropertyDescriptor(target, key);
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
  }) as ProxyLens<A>;

  return proxy;
};
