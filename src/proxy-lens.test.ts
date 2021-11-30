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
      e: "cool",
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

describe("compose", () => {
  test("mapping function for a lens", () => {
    const eLens = lens.a.d.e;

    const lengthLens = eLens.compose<number>({
      get(state) {
        return state.length;
      },
      set(state, count) {
        return `${state}${"!".repeat(count)}`;
      },
    });

    const [e1, setE] = eLens.useState();
    const [length1, addExclamations] = lengthLens.useState();

    expect(e1).toEqual("cool");
    expect(length1).toEqual(4);

    addExclamations(3);

    const [e2] = eLens.useState();
    const [length2, addMoreExclamations] = lengthLens.useState();

    expect(e2).toEqual("cool!!!");
    expect(length2).toEqual(7);

    addMoreExclamations(2);
    addExclamations(5);

    const [e3] = eLens.useState();

    expect(e3).toEqual("cool!!!!!!!!!!");

    setE("potato");

    const [e4] = eLens.useState();
    const [length4] = lengthLens.useState();

    expect(e4).toEqual("potato");
    expect(length4).toEqual(6);
  });
});

describe("traverse", () => {
  test("traverses each element of a lens", () => {
    const fLens = lens.a.f;

    const strLens = fLens.traverse<"a" | "b" | "c">({
      get(state) {
        if (state === undefined) {
          return "a";
        }

        if (state.g) {
          return "b";
        } else {
          return "c";
        }
      },

      set(state, value) {
        switch (value) {
          case "a":
            return undefined;
          case "b":
            return { g: true };
          case "c":
            return { g: false };
        }
      },
    });

    const [f1] = fLens.useState();
    const [str1, nextStr] = strLens.useState();

    expect(f1).toHaveLength(3);
    expect(str1).toEqual(["b", "c", "b"]);

    nextStr(["b", "b", "b", "c", "c", "c"]);

    const [f2, setF] = fLens.useState();

    expect(f2).toEqual([{ g: true }, { g: true }, { g: true }, { g: false }, { g: false }, { g: false }]);

    setF([{ g: false }]);

    const [str2] = strLens.useState();

    expect(str2).toEqual(["c"]);
  });
});
