/**
 * @jest-environment jsdom
 */

import { act, render, screen } from "@testing-library/react";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { concave, Lens } from "./react";
import type { ShouldUpdate } from "./should-update";

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

const [lens, handler] = concave<State>(initialState);

beforeEach(() => {
  handler.update(() => initialState);
});

const App = (props: { state: Lens<State> }) => {
  const [cState, setC] = props.state.a.b.c.use();

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

  const E = React.memo((props: { state: Lens<State> }) => {
    props.state.a.d.e.use();

    eRenderCount++;

    return <div />;
  });

  const B = React.memo((props: { state: Lens<State> }) => {
    const [b] = props.state.a.b.use();

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
    state: Lens<{ g: boolean }>;
  };

  const G = React.memo((props: GProps) => {
    const [g, updateG] = props.state.use();

    const onClick = () => updateG((prev) => ({ ...prev, g: !prev.g }));

    gRenderCount++;

    return <button data-testid="toggle-g" onClick={onClick}></button>;
  });

  type FProps = {
    shouldUpdate?: ShouldUpdate<State["f"]>;
  };

  const F = (props: FProps) => {
    const [fState, updateF] = lens.f.use(props.shouldUpdate);

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

test("does not throw error with stateful lens", () => {
  const [otherLens] = concave(initialState);

  expect(() => render(<App state={otherLens} />)).not.toThrow();
});

test("multiple hooks only trigger one re-render", () => {
  let renderCount = 0;

  const Test = () => {
    lens.use();
    const [c, setC] = lens.a.b.c.use();

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
    const [state] = lens.use();

    return <pre>{state.a.b.c}</pre>;
  };

  const result = ReactDOMServer.renderToString(<Test />);

  expect(result).toEqual(`<pre>cool</pre>`);
});

test("ignores passing the same value", () => {
  let renderCount = 0;

  const Test = () => {
    lens.use();
    const [a, setA] = lens.a.use();

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