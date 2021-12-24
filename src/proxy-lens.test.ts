import { initProxyLens, ProxyLens } from "./proxy-lens";
import { ReactDevtools } from "./react-devtools";

type State = {
  a: {
    b: {
      c: number;
    };
    d: {
      e: string;
    };

    f: Array<{ g: boolean }>;
  };
};

const initialState = (): State => ({
  a: {
    b: {
      c: 0,
    },
    d: {
      e: "cool",
    },

    f: [{ g: true }, { g: false }, { g: true }],
  },
});

let globalState: State;
let lens: ProxyLens<State>;

beforeEach(() => {
  globalState = initialState();

  lens = initProxyLens<State>((focus) => {
    /**
     * Ignore keyPath and shouldUpdate here as their implementation
     * should be left up to the React case.
     */
    return () =>
      [
        focus.lens.get(globalState),
        (updater) => {
          globalState = focus.lens.set(globalState, updater(focus.lens.get(globalState)));
        },
      ] as const;
  });
});

describe("use", () => {
  test("creates a wrapper around a value", () => {
    const [state] = lens.use();
    expect(state.toJSON()).toEqual(globalState);

    const [bState] = lens.a.b.use();
    expect(bState.toJSON()).toEqual(globalState.a.b);
  });

  test("can update state", () => {
    const [bState, setB] = lens.a.b.use();

    setB(() => ({ c: 500 }));

    const [nextBState] = lens.a.b.use();

    expect(bState.toJSON()).not.toEqual(nextBState.toJSON());
    expect(nextBState).toMatchObject({ c: 500 });
  });

  test("does not expose `toLens` on primitive values", () => {
    const [bState] = lens.a.b.use();
    const [cState] = lens.a.b.c.use();

    expect(bState).toHaveProperty("toLens");
    expect(cState).not.toHaveProperty("toLens");
  });
});

test("always returns the same proxy value", () => {
  const [state1, updateState] = lens.use();
  const [state2] = lens.use();
  const [aState] = lens.a.use();

  expect(state1).toBe(state2);
  expect(state1.toJSON).toBe(state2.toJSON);
  expect(state1.a).toBe(aState);

  updateState((prev) => ({ ...prev }));

  const [state3] = lens.use();

  expect(state3).not.toBe(state2);
  expect(state3.toJSON).not.toBe(state2.toJSON);
  expect(state3.a).toBe(aState);
});

describe("returning the same proxy lens", () => {
  test("returns the same proxy lens when toggled", () => {
    const [state] = lens.use();

    expect(state.toLens()).toBe(lens);
  });

  test("from within lists of things", () => {
    const [fState] = lens.a.f.use();

    const first = fState[0];

    expect(first.toLens()).toBe(lens.a.f[0]);
  });

  test("when a list is copied but the members stay the same", () => {
    const [fState, setF] = lens.a.f.use();
    const f1 = fState[0];

    // problem here is we return the wrapped value instead of the next one and so they don't wrap
    setF((f) => [...f, { g: true }]);

    const [nextFState] = lens.a.f.use();
    const nextF1 = nextFState[0];

    expect(fState.length + 1).toEqual(nextFState.length);
    expect(f1.toLens()).toBe(nextF1.toLens()); // the lens should be the same
    expect(nextFState.toLens()).toBe(lens.a.f);
    expect(f1).toBe(nextF1); // the proxy should have the same value
  });

  test("when an object is copied by the members stay the same", () => {
    const [bState, setBState] = lens.a.b.use();
    const [dState] = lens.a.d.use();

    const nextBState = { c: 5000 };

    setBState(() => ({ c: 5000 }));

    const [aState] = lens.a.use();

    expect(aState.b.toJSON()).toEqual(nextBState);
    expect(aState.d).toBe(dState);
    expect(aState.d.toLens()).toBe(lens.a.d);
    expect(dState.toLens()).toBe(lens.a.d);
    expect(bState.toLens()).toBe(lens.a.b);
    expect(bState.toLens()).toBe(aState.b.toLens());
  });

  test("checking for errors when making copies", () => {
    const [obj] = lens.use();

    expect(() => ({ ...obj })).not.toThrow();
    expect(() => Object.assign({}, obj)).not.toThrow();

    expect(() => [...obj.a.f]).not.toThrow();

    // iterate
    for (const key in obj) {
      expect(typeof key).not.toEqual("symbol");
    }

    for (const value of obj.a.f) {
      expect(typeof value).not.toEqual("symbol");
    }

    expect(() => ({ ...lens })).toThrow();

    expect(() => Object.getOwnPropertyDescriptors(lens)).toThrow();
  });
});

describe("inside React Devtools", () => {
  test("does not throw getting descriptors", () => {
    jest.spyOn(ReactDevtools, "isCalledInsideReactDevtools").mockImplementationOnce(() => true);
    expect(() => Object.getOwnPropertyDescriptors(lens)).not.toThrow();
  });
});

test("making a copy of a ProxyValue preserves the same attributes", () => {
  const [obj] = lens.use();
  const copy = { ...obj };

  expect(copy.toLens()).toBe(lens);
  expect(copy.toJSON()).toEqual(JSON.parse(JSON.stringify(copy)));
  expect(copy).toEqual(obj);
});

test("making a copy, dot-navigating, and then returning to a lens works", () => {
  const [obj] = lens.use();
  const copy = { ...obj };

  const b = copy.a.b;
  const f0 = copy.a.f[0];

  expect(b.toLens()).toBe(lens.a.b);
  expect(f0.toLens()).toBe(lens.a.f[0]);
});
