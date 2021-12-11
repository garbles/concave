/**
 * @jest-environment jsdom
 */

import React from "react";
import { act, render, screen } from "@testing-library/react";
import { create } from "./react";
import { ProxyLens } from "../src/proxy";

type State = {
  a: {
    b: {
      c: string;
    };
    d: {
      e: number;
    };
  };
};

const initialState = { a: { b: { c: "cool" }, d: { e: 0 } } };

const { LensProvider, lens } = create<State>();

const App = (props: { state: ProxyLens<State> }) => {
  const [c, setC] = props.state.a.b.c.use();

  const onClick = () => setC(c + "!");

  return (
    <div data-testid="element" onClick={onClick}>
      {c}
    </div>
  );
};

test("renders", () => {
  render(<LensProvider.Stateful initialValue={initialState}>{<App state={lens} />}</LensProvider.Stateful>);

  const el = screen.getByTestId("element");

  expect(el.innerHTML).toEqual("cool");
});

test("updates", () => {
  render(<LensProvider.Stateful initialValue={initialState}>{<App state={lens} />}</LensProvider.Stateful>);

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

test.only("does not re-render adjacent that do not listen to same state elements", () => {
  const eRenderCount = jest.fn();
  const bRenderCount = jest.fn();

  const E = React.memo((props: { state: ProxyLens<State> }) => {
    const [e] = props.state.a.d.e.use();

    eRenderCount();

    return <div />;
  });

  const B = React.memo((props: { state: ProxyLens<State> }) => {
    const [b] = props.state.a.b.use();

    bRenderCount();

    return <div data-testid="b" data-b={JSON.stringify(b)} />;
  });

  render(
    <LensProvider.Stateful initialValue={initialState}>
      <App state={lens} />
      <E state={lens} />
      <B state={lens} />
    </LensProvider.Stateful>
  );

  const el = screen.getByTestId("element");
  const b = screen.getByTestId("b");

  expect(eRenderCount).toHaveBeenCalledTimes(1);
  expect(bRenderCount).toHaveBeenCalledTimes(1);

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

  expect(eRenderCount).toHaveBeenCalledTimes(1);
  expect(bRenderCount).toHaveBeenCalledTimes(5);
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
