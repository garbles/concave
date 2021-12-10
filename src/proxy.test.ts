import { createProxyLens, ProxyLens } from "./proxy";
import { createBasicLens, BasicLens } from "./basic-lens";

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

const createUseState = <A>(lens: BasicLens<State, A>) => {
  return () =>
    [
      lens.get(globalState),
      (next: A) => {
        globalState = lens.set(globalState, next);
      },
    ] as const;
};

beforeEach(() => {
  globalState = initialState();

  lens = createProxyLens<State, State>({
    createUseState,
    lens: createBasicLens(),
  });
});

describe("useState", () => {
  test("creates a wrapper around a lens", () => {
    const [state] = lens.use();
    expect(state).toMatchObject(globalState);

    const [bState] = lens.a.b.use();
    expect(bState).toEqual(globalState.a.b);
  });

  test("can update state", () => {
    const [bState, setB] = lens.a.b.use();

    setB({ c: 500 });

    const [nextBState] = lens.a.b.use();

    expect(bState).not.toEqual(nextBState);
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

    setF([...fState, { g: true }]);

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

    setBState(nextBState);

    const [aState] = lens.a.use();

    expect(aState.b).toEqual(nextBState);
    expect(aState.d).toBe(dState);
    expect(aState.d.toLens()).toBe(lens.a.d);
    expect(dState.toLens()).toBe(lens.a.d);
    expect(bState.toLens()).toBe(lens.a.b);
    expect(bState.toLens()).toBe(aState.b.toLens());
  });
});
