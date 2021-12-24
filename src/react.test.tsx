/**
 * @jest-environment jsdom
 */

import { act, render, screen } from "@testing-library/react";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { useLens } from "./react";
import { createLens } from "./create-lens";
import { ShouldUpdate } from "./should-update";
import { ProxyLens } from "./proxy-lens";

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

const lens = createLens<State>(initialState);

beforeEach(() => {
  const store = lens.getStore();
  store.update(() => initialState);
});

const App = (props: { state: ProxyLens<State> }) => {
  const [cState, setC] = useLens(props.state.a.b.c);

  const onClick = () => setC((c) => c + "!");

  return (
    <div data-testid="element" onClick={onClick}>
      {cState}
    </div>
  );
};

test("renders", () => {
  render(<App state={lens} />);

  const el = screen.getByTestId("element");

  expect(el.innerHTML).toEqual("cool");
});

test("updates", () => {
  render(<App state={lens} />);

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
    useLens(props.state.a.d.e);

    eRenderCount++;

    return <div />;
  });

  const B = React.memo((props: { state: ProxyLens<State> }) => {
    const [b] = useLens(props.state.a.b);

    bRenderCount++;

    return <div data-testid="b" data-b={JSON.stringify(b)} />;
  });

  render(
    <>
      <App state={lens} />
      <E state={lens} />
      <B state={lens} />
    </>
  );

  const el = screen.getByTestId("element");
  const b = screen.getByTestId("b");

  expect(eRenderCount).toEqual(1);
  expect(bRenderCount).toEqual(1);

  expect(JSON.parse(b.dataset.b ?? "")).toEqual({ c: "cool" });

  act(() => {
    el.click();
    el.click();
    el.click();
    el.click();
  });

  expect(eRenderCount).toEqual(1);

  /**
   * Multiple '!' added to the string, but only re-renders once
   */
  expect(bRenderCount).toEqual(2);
  expect(JSON.parse(b.dataset.b ?? "")).toEqual({ c: "cool!!!!" });
});

describe("should update", () => {
  let gRenderCount = 0;
  let fRenderCount = 0;

  type GProps = {
    state: ProxyLens<{ g: boolean }>;
  };

  const G = React.memo((props: GProps) => {
    const [g, updateG] = useLens(props.state);

    const onClick = () => updateG((prev) => ({ ...prev, g: !prev.g }));

    gRenderCount++;

    return <button data-testid="toggle-g" onClick={onClick}></button>;
  });

  type FProps = {
    shouldUpdate?: ShouldUpdate<State["f"]>;
  };

  const F = (props: FProps) => {
    const [fState, updateF] = useLens(lens.f, props.shouldUpdate);

    const onClick = () => {
      updateF((f) => [...f, { g: true }]);
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

  beforeEach(() => {
    gRenderCount = 0;
    fRenderCount = 0;
  });

  test("re-renders a list when memebers added to a list", () => {
    render(<F />);

    const pushGButton = screen.getByTestId("push-g-button");

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
  });

  test("accepts length for lists", () => {
    // noop. just a typecheck here
    render(<F shouldUpdate={["length"]} />);
  });

  test("function returning false never re-renders", () => {
    render(<F shouldUpdate={() => false} />);

    const pushGButton = screen.getByTestId("push-g-button");

    act(() => {
      pushGButton.click();
    });

    act(() => {
      pushGButton.click();
    });

    act(() => {
      pushGButton.click();
    });

    expect(fRenderCount).toEqual(1);
    expect(gRenderCount).toEqual(2); // Gs are never added because F does not re-render
  });

  test.each([(prev, next) => prev.length !== next.length, [], {}] as ShouldUpdate<State["f"]>[])(
    "does not re-render unless the length has changed",
    (shouldUpdate) => {
      render(<F shouldUpdate={shouldUpdate} />);

      expect(fRenderCount).toEqual(1);
      expect(gRenderCount).toEqual(2);

      act(() => {
        const pushGButton = screen.getByTestId("push-g-button");
        pushGButton.click();
      });

      expect(fRenderCount).toEqual(2);
      expect(gRenderCount).toEqual(3);

      act(() => {
        const toggleGButtons = screen.queryAllByTestId("toggle-g");
        toggleGButtons.forEach((button) => button.click());
      });

      expect(fRenderCount).toEqual(2); // does not change
      expect(gRenderCount).toEqual(6); // re-renders all Gs
    }
  );
});

test("multiple hooks only trigger one re-render", () => {
  let renderCount = 0;

  const Test = () => {
    useLens(lens);
    const [c, setC] = useLens(lens.a.b.c);

    renderCount++;

    return <button data-testid="c-button" onClick={() => setC((c) => c + "!")} />;
  };

  render(<Test />);

  expect(renderCount).toEqual(1);

  const button = screen.getByTestId("c-button");

  act(() => {
    button.click();
  });

  expect(renderCount).toEqual(2);
});

test("renders to string", () => {
  const Test = () => {
    const [state] = useLens(lens);

    return <pre>{state.a.b.c}</pre>;
  };

  const result = ReactDOMServer.renderToString(<Test />);

  expect(result).toEqual(`<pre>cool</pre>`);
});

test("ignores passing the same value", () => {
  let renderCount = 0;

  const Test = () => {
    useLens(lens);
    const [a, setA] = useLens(lens.a);

    renderCount++;

    return <button data-testid="a-button" onClick={() => setA((next) => next)} />;
  };

  render(<Test />);

  expect(renderCount).toEqual(1);

  const button = screen.getByTestId("a-button");

  act(() => {
    button.click();
  });

  expect(renderCount).toEqual(1);
});
