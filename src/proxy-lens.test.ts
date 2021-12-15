import { basicLens, BasicLens } from "./basic-lens";
import { proxyLens, ProxyLens } from "./proxy-lens";

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

const createUse = <A>(lens: BasicLens<State, A>) => {
  return () =>
    [
      lens.get(globalState),
      (fn: (a: A) => A) => {
        globalState = lens.set(globalState, fn(lens.get(globalState)));
      },
    ] as const;
};

beforeEach(() => {
  globalState = initialState();

  lens = proxyLens<State, State>({
    lens: basicLens(),
    createUse,
  });
});

describe("use", () => {
  test("creates a wrapper around a lens", () => {
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

  test("making a copy of an object will throw an error", () => {
    const [obj] = lens.use();

    expect(() => ({ ...obj })).toThrow();
    expect(() => Object.assign({}, obj)).toThrow();

    expect(() => [...obj.a.f]).not.toThrow();

    expect(() => {
      // iterate
      for (const key in obj) {
      }
    }).not.toThrow();

    expect(() => {
      // iterate
      for (const value of obj.a.f) {
      }
    }).not.toThrow();
  });
});

test("prevents making a copy of the lens", () => {
  expect(() => ({ ...lens })).toThrow();
});
