/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen } from "@testing-library/react";
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

const { LensProvider, StatefulLensProvider } = create<State>();

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
  render(<StatefulLensProvider initialValue={initialState}>{(lens) => <App state={lens} />}</StatefulLensProvider>);

  const el = screen.getByTestId("element");

  expect(el.innerHTML).toEqual("cool");
});

test("updates", () => {
  render(<StatefulLensProvider initialValue={initialState}>{(lens) => <App state={lens} />}</StatefulLensProvider>);

  const el = screen.getByTestId("element");

  expect(el.innerHTML).toEqual("cool");

  el.click();
  el.click();
  el.click();
  el.click();

  expect(el.innerHTML).toEqual("cool!!!!");
});

test("does not re-render adjacent that do not listen to same state elements", () => {
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
    <StatefulLensProvider initialValue={initialState}>
      {(lens) => {
        return (
          <>
            <App state={lens} />
            <E state={lens} />
            <B state={lens} />
          </>
        );
      }}
    </StatefulLensProvider>
  );

  const el = screen.getByTestId("element");
  const b = screen.getByTestId("b");

  expect(eRenderCount).toHaveBeenCalledTimes(1);
  expect(bRenderCount).toHaveBeenCalledTimes(1);
  expect(JSON.parse(b.dataset.b ?? "")).toEqual({ c: "cool" });

  el.click();
  el.click();
  el.click();
  el.click();

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
      {(lens) => <App state={lens} />}
    </LensProvider>
  );

  const { rerender } = render(make());

  const el = screen.getByTestId("element");

  expect(el.innerHTML).toEqual("cool");

  el.click();
  state.a.b.c = "hello";
  rerender(make());

  expect(el.innerHTML).toEqual("hello");

  el.click();
  el.click();

  expect(el.innerHTML).toEqual("hello!!");

  state.a.b.c = "goodbye";
  rerender(make());
  el.click();

  expect(el.innerHTML).toEqual("goodbye!");
});
