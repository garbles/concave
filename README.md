<p align="center">
  <img src="./image.png" />
</p>

Lens-like state management (for React).

## Overview

Concave is not a general purpose state management library. It is intended for highly interactive UIs where the shape of the state is recursive and/or closely reflects the shape of the UI. Specifically, Concave is an excellent candidate for page/form/diagram builder-type applications (written in React).

#### Why use Concave?

1. Excellent for handling recursive application states.
2. Use it where you need it. Not an all or nothing solution.
3. Minimalistic and intuitive API.
4. Superior component testing experience.

### Create your lens

```ts
// lens.ts

import { createLens } from "concave";
import { AppState, initialAppState } from "./state";

export const lens = createLens<AppState>(initialAppState);
```

### Render your application

```tsx
// index.tsx

import React from "react";
import ReactDOM from "react";
import { lens } from "./lens";
import { App } from "./components/App";

const render = ReactDOM.createRoot(document.querySelector("#root"));

render(<App state={lens} />);
```

## A brief introduction to lenses for React/Redux developers

If you have built React applications with Redux then you are probably familiar with [selectors](https://redux.js.org/usage/deriving-data-selectors). A selector is a "getter" from the monolithic application state meant to obfuscate the shape of that state from the rest of the application.

```ts
import { State, UserState } from "./state";

export const getUser = (state: State) => state.user;

export const getUserName = (state: State) => getUser(state).name;
```

The second "getter", `getUserName`, is a "refinement" on `getUser`. It gives us a way to write `getUserName` in terms of the _entire_ application state without revealing it. That is, `getUserName` only needs to know the shape of `User`, while `getUser` can get it from the parent. And so on...

Now instead of a dispatching actions, consider how it would look to update the application state with a series of "setters".

```ts
export const setUser = (state: State, user: User) => {
  return {
    ...state,
    user,
  };
};

export const setUserName = (state: State, name: string) => {
  const user = getUser(state);

  return setUser(state, {
    ...user,
    name,
  });
};
```

Again, notice how the second "setter" relies on the first: `setUserName` is a "refinement" of `setUser`. Once more, `setUserName` can rely on `getUser` and `setUser` in order to get and set the user on the global state without revealing it.

_A Lens is essentially a "getter" and "setter" pair that are always "refined" at the same time._

## Installation

This library uses `useSyncExternalStore` (introduced in React 18). If you want to use Concave with a version of React older than 18, you must also [install a shim](https://github.com/reactwg/react-18/discussions/86).

```bash
npm install concave use-sync-external-store
```

## API

### createLens

`createLens<S>(initialState: S): Lens<S>`

### Lens

`Lens<A>`

A stateless [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) around a type `A`.

### Store

`Store<A>`

## Extensions for React

### useLens

`useLens<A>(lens: Lens<A>, shouldUpdate? ShouldUpdate<A>): [Value<A>, Update<A>]`

Integrates a `Lens<A>` into the React life-cycle and returns a tuple, similar to `useState`.

### useCreateLens

`useCreateLens<A>(initialState: S): Lens<S>`

A convenience wrapper that just memoizes a call to `createLens`.

Quite literally: `React.useMemo(() => createLens(initialState), [])`.

<!--

## Examples

## Testing

## Performance

1. Use shouldUpdate.

2. If do use a shouldUpdate argument for the lens, you can either memoize it with `React.useMemo` or `React.useCallback` or store it outside of the component.

3. Memoize every component with `React.memo` foward lenses as props rather than globals.

-->
