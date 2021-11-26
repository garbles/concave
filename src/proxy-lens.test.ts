import { createProxyLens, ProxyLens } from "./proxy-lens";
import { createRawLens, RawLens } from "./raw-lens";

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
      e: "!",
    },

    f: [{ g: true }, { g: false }, { g: true }],
  },
});

let globalState: State;
let lens: ProxyLens<State>;

beforeEach(() => {
  globalState = initialState();
  lens = createProxyLens<State, State>(createRawLens(), createUseState);
});

const createUseState = <A>(lens: RawLens<State, A>) => {
  return () =>
    [
      lens.get(globalState),
      (next: A) => {
        globalState = lens.set(globalState, next);
      },
    ] as const;
};

describe("useState", () => {
  test("creates a wrapper around a lens", () => {
    const [state] = lens.useState();
    expect(state).toEqual(globalState);

    const [bState] = lens.a.b.useState();
    expect(bState).toEqual(globalState.a.b);
  });

  test("can update state", () => {
    const [bState, setB] = lens.a.b.useState();

    setB({ c: 500 });

    const [nextBState] = lens.a.b.useState();

    expect(bState).not.toEqual(nextBState);
    expect(nextBState).toEqual({ c: 500 });
  });
});

describe("useMap", () => {
  test("traverses over a list and wraps each value in a lens", () => {
    const next = lens.a.f.useMap((lens) => {
      const [bool] = lens.g.useState();
      return Number(bool);
    });

    expect(next).toEqual([1, 0, 1]);
  });
});
