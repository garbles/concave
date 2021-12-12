/**
 * @jest-environment jsdom
 */

import { act, render, screen } from "@testing-library/react";
import React from "react";
import { ProxyLens } from "./proxy-lens";
import { create } from "./react";

type State = {
  a: {
    b: {
      c: string;
    };
    d: {
      e: number;
    };
  };
  f: { g: boolean }[];
};

const initialState: State = { a: { b: { c: "cool" }, d: { e: 0 } }, f: [{ g: true }, { g: false }] };

const { LensProvider, lens } = create<State>();

const App = (props: { state: ProxyLens<State> }) => {
  const [cState, setC] = props.state.a.b.c.use();

  const onClick = () => setC((c) => c + "!");

  return (
    <div data-testid="element" onClick={onClick}>
      {cState}
    </div>
  );
};

const Provider: React.FC = (props) => (
  <LensProvider.Stateful initialValue={initialState}>{props.children}</LensProvider.Stateful>
);

test("renders", () => {
  render(<Provider>{<App state={lens} />}</Provider>);

  const el = screen.getByTestId("element");

  expect(el.innerHTML).toEqual("cool");
});

test("updates", () => {
  render(<Provider>{<App state={lens} />}</Provider>);

  const el = screen.getByTestId("element");

  expect(el.innerHTML).toEqual("cool");

  act(() => {
    el.click();
  });

  act(() => {
    el.click();
  });

  act(() => {
    el.click();
  });

  act(() => {
    el.click();
  });

  expect(el.innerHTML).toEqual("cool!!!!");
});

test("does not re-render adjacent that do not listen to same state elements", () => {
  let eRenderCount = 0;
  let bRenderCount = 0;

  const E = React.memo((props: { state: ProxyLens<State> }) => {
    props.state.a.d.e.use();

    eRenderCount++;

    return <div />;
  });

  const B = React.memo((props: { state: ProxyLens<State> }) => {
    const [b] = props.state.a.b.use();

    bRenderCount++;

    return <div data-testid="b" data-b={JSON.stringify(b)} />;
  });

  render(
    <Provider>
      <App state={lens} />
      <E state={lens} />
      <B state={lens} />
    </Provider>
  );

  const el = screen.getByTestId("element");
  const b = screen.getByTestId("b");

  expect(eRenderCount).toEqual(1);
  expect(bRenderCount).toEqual(1);

  expect(JSON.parse(b.dataset.b ?? "")).toEqual({ c: "cool" });

  act(() => {
    el.click();
  });

  act(() => {
    el.click();
  });

  act(() => {
    el.click();
  });

  act(() => {
    el.click();
  });

  expect(eRenderCount).toEqual(1);
  expect(bRenderCount).toEqual(5);
  expect(JSON.parse(b.dataset.b ?? "")).toEqual({ c: "cool!!!!" });
});

test("renders sets new props into the lens", () => {
  let state = initialState;

  const make = () => (
    <LensProvider
      value={initialState}
      onChange={(next) => {
        state = next;
      }}
    >
      <App state={lens} />
    </LensProvider>
  );

  const { rerender } = render(make());

  const el = screen.getByTestId("element");

  expect(el.innerHTML).toEqual("cool");

  act(() => {
    el.click();
  });

  state.a.b.c = "hello";
  rerender(make());

  expect(el.innerHTML).toEqual("hello");

  act(() => {
    el.click();
  });

  act(() => {
    el.click();
  });

  expect(el.innerHTML).toEqual("hello!!");

  state.a.b.c = "goodbye";
  rerender(make());

  act(() => {
    el.click();
  });

  expect(el.innerHTML).toEqual("goodbye!");
});

test("only re-renders a list when new members of a list should a shouldUpdate condition is applied", () => {
  let gRenderCount = 0;
  let fRenderCount = 0;

  type GProps = {
    state: ProxyLens<{ g: boolean }>;
  };

  const G = React.memo((props: GProps) => {
    props.state.use();

    gRenderCount++;

    return null;
  });

  type FProps = {
    shouldUpdate?(prev: { g: boolean }[], next: { g: boolean }[]): boolean;
  };

  const F = (props: FProps) => {
    const [fState, setF] = lens.f.use(props.shouldUpdate);

    const onClick = () => {
      setF((f) => [...f, { g: true }]);
    };

    fRenderCount++;

    return (
      <div>
        {fState.map((g) => {
          const lens = g.toLens();
          return <G key={lens.$key} state={lens} />;
        })}
        <button data-testid="push-g-button" onClick={onClick} />;
      </div>
    );
  };

  const { getByTestId, rerender } = render(
    <Provider>
      <F />
    </Provider>
  );

  const pushGButton = getByTestId("push-g-button");

  expect(fRenderCount).toEqual(1);
  expect(gRenderCount).toEqual(2);

  act(() => {
    pushGButton.click();
  });

  expect(fRenderCount).toEqual(2);
  expect(gRenderCount).toEqual(3);

  act(() => {
    pushGButton.click();
  });

  expect(fRenderCount).toEqual(3);
  expect(gRenderCount).toEqual(4);

  /**
   * reset all render counts
   */
  fRenderCount = 0;
  gRenderCount = 0;

  rerender(
    <Provider>
      <F shouldUpdate={(prev, next) => prev.length !== next.length} />
    </Provider>
  );

  expect(fRenderCount).toEqual(1);
  expect(gRenderCount).toEqual(0);

  act(() => {
    pushGButton.click();
  });

  expect(fRenderCount).toEqual(2);
  expect(gRenderCount).toEqual(1); // only incremented by 1

  // instead here update all of the G's and see that F does not re-render
});

test.todo("making a copy of data will remove the `toLens` call");
