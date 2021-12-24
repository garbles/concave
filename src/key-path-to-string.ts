import { Key } from "./types";

const cache = new WeakMap<Key[], string>();
const IS_NUMBER_STRING = /^\d+$/;

export const keyPathToString = (keyPath: Key[]) => {
  let cached = cache.get(keyPath);

  if (!cached) {
    cached = "root";

    for (let key of keyPath) {
      if (typeof key === "symbol" || typeof key === "number" || key.match(IS_NUMBER_STRING)) {
        cached += `[${String(key)}]`;
      } else {
        cached += `.${key}`;
      }
    }

    cache.set(keyPath, cached);
  }

  return cached;
};
