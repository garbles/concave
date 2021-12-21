type Key = string | number | symbol;

export const debugKeyPath = (keyPath: Key[], prefix = "lens") => {
  let result = prefix;

  for (let key of keyPath) {
    if (typeof key === "symbol" || typeof key === "number" || key.match(/^\d+$/)) {
      result += `[${String(key)}]`;
    } else {
      result += `.${key}`;
    }
  }

  return result;
};
