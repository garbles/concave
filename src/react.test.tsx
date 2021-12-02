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
  };
};

const { StatefulLensProvider } = create<State>();

test("renders", () => {
  const App = (props: { state: ProxyLens<State> }) => {
    const [c] = props.state.a.b.c.useState();

    return <div data-testid="element">{c}</div>;
  };

  render(
    <StatefulLensProvider initialValue={{ a: { b: { c: "cool" } } }}>
      {(lens) => <App state={lens} />}
    </StatefulLensProvider>
  );

  const el = screen.getByTestId("element");

  expect(el.innerHTML).toEqual("cool");
});
