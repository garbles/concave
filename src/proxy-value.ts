import { isObject } from "./is-object";
import { ProxyLens } from "./proxy-lens";
import { AnyArray, AnyObject, AnyPrimitive, Key } from "./types";

type Proxyable = AnyArray | AnyObject;

type BaseProxyValue<A> = {
  toJSON(): A;
  toLens(): ProxyLens<A>;
};

type ArrayProxyValue<A extends AnyArray> = BaseProxyValue<A> & Array<ProxyValue<A[number]>>;
type ObjectProxyValue<A extends AnyObject> = BaseProxyValue<A> & { [K in keyof A]: ProxyValue<A[K]> };

// prettier-ignore
export type ProxyValue<A> =
  A extends AnyArray ? ArrayProxyValue<A> :
  A extends AnyObject ? ObjectProxyValue<A> :
  A extends AnyPrimitive ? A :
  never;

const isProxyable = (obj: any): obj is Proxyable => Array.isArray(obj) || isObject(obj);

const proxyValueHandler: ProxyHandler<{ data: {}; lens: ProxyLens<{}>; toJSON?(): {}; toLens?(): ProxyLens<{}> }> = {
  get(target, key) {
    if (key === "toJSON") {
      target.toJSON ??= () => target.data;
      return target.toJSON;
    }

    if (key === "toLens") {
      target.toLens ??= () => target.lens;
      return target.toLens;
    }

    const nextData = target.data[key as keyof typeof target.data];
    const nextLens = (target.lens as any)[key as keyof typeof target.lens];

    return proxyValue<{}>(nextData, nextLens);
  },

  ownKeys(target) {
    return Reflect.ownKeys(target.data).concat(["toLens", "toJSON"]);
  },

  getOwnPropertyDescriptor(target, key) {
    /**
     * If the key is one of the special ProxyValue keys,
     * set the property descriptor to a custom value.
     */
    if (key === "toLens" || key === "toJSON") {
      return {
        configurable: true,
        enumerable: true,
        writable: false,
        value: target[key],
      };
    }

    const desc = Object.getOwnPropertyDescriptor(target.data, key);

    /**
     * Now bail if the descriptor is `undefined`. This could only
     * occur if the key is not `keyof A`.
     */
    if (desc === undefined) {
      return;
    }

    return {
      writable: desc.writable,
      enumerable: desc.enumerable,
      configurable: desc.configurable,
      value: target.data[key as keyof typeof target.data],
    };
  },
  has(target, key) {
    return key in target.data;
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
    throw new Error("Cannot set property on ProxyValue");
  },
  deleteProperty() {
    throw new Error("Cannot delete property on ProxyValue");
  },
};

const valueCache = new WeakMap<{}, ProxyValue<{}>>();

export const proxyValue = <A>(data: A, lens: ProxyLens<A>): ProxyValue<A> => {
  if (!isProxyable(data)) {
    return data as ProxyValue<A>;
  }

  let cached = valueCache.get(data) as ProxyValue<A>;

  if (!cached) {
    cached = new Proxy({ data, lens } as any, proxyValueHandler);
    valueCache.set(data, cached as ProxyValue<{}>);
  }

  return cached;
};
