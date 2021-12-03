/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { create } from "./react";
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
};

const initialState = { a: { b: { c: "cool" }, d: { e: 0 } } };

const { StatefulLensProvider } = create<State>();

const App = (props: { state: ProxyLens<State> }) => {
  const [c, setC] = props.state.a.b.c.useState();

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
    const [e] = props.state.a.d.e.useState();

    eRenderCount();

    return <div />;
  });

  const B = React.memo((props: { state: ProxyLens<State> }) => {
    const [b] = props.state.a.b.useState();

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
