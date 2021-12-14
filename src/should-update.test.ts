import { shouldUpdateToFunction } from "./should-update";

describe("when it is a boolean", () => {
  test("does a simple reference check on true", () => {
    const check = shouldUpdateToFunction(true);
    const obj = {};

    expect(check(1, 1)).toEqual(false);
    expect(check(1, 0)).toEqual(true);
    expect(check(obj, obj)).toEqual(false);
  });

  test("always returns false on false", () => {
    const check = shouldUpdateToFunction(false);
    const obj = {};

    expect(check(1, 1)).toEqual(false);
    expect(check(1, 0)).toEqual(false);
    expect(check(obj, obj)).toEqual(false);
  });
});

describe("when it is an array", () => {
  test("checks only the keys listed", () => {
    const check = shouldUpdateToFunction<{ a: number; b: number; c: number }>(["a", "b"]);

    expect(check({ a: 1, b: 2, c: 3 }, { a: 1, b: 2, c: 4 })).toEqual(false);
    expect(check({ a: 1, b: 1, c: 3 }, { a: 1, b: 2, c: 4 })).toEqual(true);
  });
});

describe("when it is an object", () => {
  test("checks the keys whose value is true", () => {
    const check = shouldUpdateToFunction<{ a: number; b: number; c: number }>({ a: true, b: true });

    expect(check({ a: 1, b: 2, c: 3 }, { a: 1, b: 2, c: 4 })).toEqual(false);
    expect(check({ a: 1, b: 1, c: 3 }, { a: 1, b: 2, c: 4 })).toEqual(true);
  });

  test("ignores those keys value is false", () => {
    const check = shouldUpdateToFunction<{ a: number; b: number; c: number }>({ a: true, b: false });

    expect(check({ a: 1, b: 2, c: 3 }, { a: 1, b: 2, c: 4 })).toEqual(false);
    expect(check({ a: 1, b: 1, c: 3 }, { a: 1, b: 2, c: 4 })).toEqual(false);
  });
});

describe("when it is a deep object", () => {
  type State = {
    a: {
      b: {
        c: Array<{ d: { message: string } }>;
        e: number;
        f: string;
      };
    };
  };

  const prev: State = {
    a: {
      b: {
        c: [{ d: { message: "hello" } }, { d: { message: "everyone" } }],
        e: 120,
        f: "120",
      },
    },
  };

  const next: State = {
    a: {
      b: {
        c: [{ d: { message: "goodbye" } }, { d: { message: "everyone" } }],
        e: 130,
        f: "120",
      },
    },
  };

  test("recursively resolves objects", () => {
    const eCheck = shouldUpdateToFunction<State>({ a: { b: { e: true } } });
    const fCheck = shouldUpdateToFunction<State>({ a: { b: { f: true } } });

    expect(eCheck(prev, next)).toEqual(true);
    expect(fCheck(prev, next)).toEqual(false);
  });

  test("recursively resolves lists of keys", () => {
    const eCheck = shouldUpdateToFunction<State>({ a: { b: ["e"] } });
    const fCheck = shouldUpdateToFunction<State>({ a: { b: ["f"] } });

    expect(eCheck(prev, next)).toEqual(true);
    expect(fCheck(prev, next)).toEqual(false);
  });

  test("allows of deeply nested functions", () => {
    const eCheck = shouldUpdateToFunction<State>({ a: { b: { e: (pe, ne) => pe !== ne } } });
    const fCheck = shouldUpdateToFunction<State>({ a: { b: { f: (pf, nf) => pf !== nf } } });

    expect(eCheck(prev, next)).toEqual(true);
    expect(fCheck(prev, next)).toEqual(false);
  });

  test("traverses arrays with objects", () => {
    const dCheck = shouldUpdateToFunction<State>({
      a: {
        b: {
          c: {
            d: {
              message: true,
            },
          },
        },
      },
    });

    const same = JSON.parse(JSON.stringify(prev));

    expect(dCheck(prev, next)).toEqual(true);
    expect(dCheck(prev, same)).toEqual(false);
  });

  test("assumes length check on arrays", () => {
    const cLengthCheck = shouldUpdateToFunction<State>({
      a: {
        b: {
          c: {},
        },
      },
    });

    const same: State = JSON.parse(JSON.stringify(prev));
    same.a.b.c.push({ d: { message: "a new one" } });

    expect(cLengthCheck(prev, next)).toEqual(false);
    expect(cLengthCheck(prev, same)).toEqual(true);
  });
});

describe("when it is a function", () => {
  test("just runs the function", () => {
    const check = (prev: unknown, next: unknown) => prev !== next;
    const fn = shouldUpdateToFunction(check);
    const obj = {};

    expect(fn).toBe(check);
    expect(fn(1, 1)).toEqual(false);
    expect(fn(1, 0)).toEqual(true);
    expect(fn(obj, obj)).toEqual(false);
  });
});
