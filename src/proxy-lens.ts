import { basicLens, BasicLens, prop } from "./basic-lens";
import { keyPathToString } from "./key-path-to-string";
import { ProxyValue } from "./proxy-value";
import { createUseLens } from "./react";
import { ReactDevtools } from "./react-devtools";
import { ShouldUpdate } from "./should-update";
import { Store } from "./store";
import { AnyArray, AnyObject, AnyPrimitive, Key, Update } from "./types";

type LensFocus<S, A> = {
  lens: BasicLens<S, A>;
  keyPath: Key[];
};

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

type ArrayProxyLens<A extends AnyArray> = BaseProxyLens<A> & { [K in number]: ProxyLens<A[K]> };
type ObjectProxyLens<A extends AnyObject> = BaseProxyLens<A> & { [K in keyof A]: ProxyLens<A[K]> };
type PrimitiveProxyLens<A extends AnyPrimitive> = BaseProxyLens<A>;

// prettier-ignore
export type ProxyLens<A> =
  A extends AnyArray ? ArrayProxyLens<A> :
  A extends AnyObject ? ObjectProxyLens<A> :
  A extends AnyPrimitive ? PrimitiveProxyLens<A> :
  never;

const THROW_ON_COPY = Symbol();

const focusProp = <S, A>(focus: LensFocus<S, A>, key: keyof A): LensFocus<S, A[keyof A]> => {
  return {
    keyPath: [...focus.keyPath, key],
    lens: prop(focus.lens, key as keyof A),
  };
};

const specialKeys: (keyof BaseProxyLens<{}>)[] = ["use", "getStore", "$key"];

export const proxyLens = <S, A>(
  storeFactory: StoreFactory<S>,
  focus: LensFocus<S, A> = { lens: basicLens<any>(), keyPath: [] }
): ProxyLens<A> => {
  type KeyCache = { [K in keyof A]?: ProxyLens<A[K]> };
  type Target = Partial<BaseProxyLens<A> & { cache: KeyCache }>;

  const proxy = new Proxy({} as Target, {
    get(target, key) {
      /**
       * Block React introspection as it will otherwise produce an infinite chain of
       * ProxyLens values in React Devtools.
       */
      if (key === "$$typeof") {
        return undefined;
      }

      if (key === "$key") {
        target.$key ??= keyPathToString(focus.keyPath);
        return target.$key;
      }

      if (key === "use") {
        target.use ??= createUseLens(proxy);
        return target.use;
      }

      if (key === "getStore") {
        target.getStore ??= () => storeFactory(focus);
        return target.getStore;
      }

      target.cache ??= {};

      if (target.cache[key as keyof A] === undefined) {
        const nextFocus = focusProp(focus, key as keyof A);
        const nextProxy = proxyLens(storeFactory, nextFocus);
        target.cache[key as keyof A] = nextProxy;
      }

      return target.cache[key as keyof A];
    },

    ownKeys(_target) {
      return [...specialKeys, THROW_ON_COPY];
    },

    has(_target, key) {
      return specialKeys.includes(key as keyof BaseProxyLens<{}>);
    },

    getOwnPropertyDescriptor(_target, key) {
      if (specialKeys.includes(key as keyof BaseProxyLens<{}>)) {
        return {
          configurable: true,
          enumerable: true,
          writable: false,
          value: proxy[key as keyof Partial<BaseProxyLens<A>>],
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
  }) as ProxyLens<A>;

  return proxy;
};
