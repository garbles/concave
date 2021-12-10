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
    const [state] = lens.useState();
    expect(state).toMatchObject(globalState);

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

  test("can specify defaults when a value is optional", () => {});
});

describe("returning the same proxy lens", () => {
  test("returns the same proxy lens when toggled", () => {
    const [state] = lens.useState();

    expect(state.toLens()).toBe(lens);
  });

  test("from within lists of things", () => {
    const [fState] = lens.a.f.useState();

    const first = fState[0];

    expect(first.toLens()).toBe(lens.a.f[0]);
  });

  test("when a list is copied but the members stay the same", () => {
    const [fState, setF] = lens.a.f.useState();
    const f1 = fState[0];

    setF([...fState, { g: true }]);

    const [nextFState] = lens.a.f.useState();
    const nextF1 = nextFState[0];

    expect(fState.length + 1).toEqual(nextFState.length);
    expect(f1.toLens()).toBe(nextF1.toLens()); // the lens should be the same
    expect(nextFState.toLens()).toBe(lens.a.f);
    expect(f1).toBe(nextF1); // the proxy should have the same value
  });

  test("when an object is copied by the members stay the same", () => {});
});

// describe("compose", () => {
//   test("mapping function for a lens", () => {
//     const eLens = lens.a.d.e;

//     const lengthLens = eLens.compose<number>({
//       get(state) {
//         return state.length;
//       },
//       set(state, count) {
//         return `${state}${"!".repeat(count)}`;
//       },
//     });

//     const [e1, setE] = eLens.useState();
//     const [length1, addExclamations] = lengthLens.useState();

//     expect(e1).toEqual("cool");
//     expect(length1).toEqual(4);

//     addExclamations(3);

//     const [e2] = eLens.useState();
//     const [length2, addMoreExclamations] = lengthLens.useState();

//     expect(e2).toEqual("cool!!!");
//     expect(length2).toEqual(7);

//     addMoreExclamations(2);
//     addExclamations(5);

//     const [e3] = eLens.useState();

//     expect(e3).toEqual("cool!!!!!!!!!!");

//     setE("potato");

//     const [e4] = eLens.useState();
//     const [length4] = lengthLens.useState();

//     expect(e4).toEqual("potato");
//     expect(length4).toEqual(6);
//   });
// });
