import { coalesce, createRawLens, prop } from "./raw-lens";

type State = {
  a: {
    b: {
      c: number;
    };
    d: {
      e: string;
    };
    f?: string;
  };
};

const state: State = {
  a: {
    b: {
      c: 100,
    },
    d: {
      e: "chicken",
    },
  },
};

const lens = createRawLens<State>();
const a = prop(lens, "a");
const b = prop(a, "b");
const c = prop(b, "c");
const f = prop(a, "f");

test("always returns the same base lens", () => {
  const a = createRawLens();
  const b = createRawLens();

  expect(a).toBe(b);
});

test("drills data", () => {
  expect(lens.get(state)).toEqual(state);
  expect(a.get(state)).toEqual(state.a);
  expect(b.get(state)).toEqual(state.a.b);
  expect(c.get(state)).toEqual(state.a.b?.c);
});

test("deeply sets data", () => {
  const next = c.set(state, 300);

  expect(next).not.toEqual(state);
  expect(next).toEqual({ a: { b: { c: 300 }, d: { e: "chicken" } } });
});

test("only updates parts of the data", () => {
  const next = b.set(state, { c: 0 });

  expect(next.a.d).toBe(state.a.d);
});

describe("coalesce", () => {
  test("removes nullability", () => {
    const next = coalesce(f, "some default");

    expect(f.get(state)).toEqual(undefined);
    expect(next.get(state)).toEqual("some default");
  });
});
