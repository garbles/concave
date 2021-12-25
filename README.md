<p align="center">
  <img src="./image.png" />
</p>

Lens-like state management (for React).

## Overview

Concave is not a general purpose state management library. It is intended for highly interactive UIs where the shape of the state is recursive and/or closely reflects the shape of the UI. Specifically, Concave is an excellent candidate for page/form/diagram builder-type applications written in React.

#### Why use Concave?

1. Excellent for handling recursive application states.
2. Use it where you need it. Not an all or nothing solution.
3. Minimalistic and intuitive API.
4. Superior component testing experience.

### Create your lens

```ts
import { createLens } from "concave";
import { AppState, initialAppState } from "./state";
```

###

## A brief introduction to lenses for React/Redux developers

If you have built React applications with Redux then you are probably familiar with [selectors](https://redux.js.org/usage/deriving-data-selectors).

## Installation

## API

### `createLens<S>(initialState: S): Lens<S>`

### `Lens<A>`

A stateless [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) around `A`

### `Store<A>`

## Use with React

### `useLens<A>(lens: Lens<A>, shouldUpdate? ShouldUpdate<A>): [Value<A>, Update<A>]`

### `useCreateLens<A>(initialState: S): Lens<S>`

## Examples

## Testing

## Performance

1. Use shouldUpdate.

2. If do use a shouldUpdate argument for the lens, you can either memoize it with `React.useMemo` or `React.useCallback` or store it outside of the component.

3. Memoize every component with `React.memo` foward lenses as props rather than globals.

<!--

## Example

Uses TypeScript and [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) to dynamically construct a lens-like interface for your application state.

You can construct a lens/React Provider by just providing the shape of your application state

```ts
// LensProvider.ts

import { stateless } from "concave";
import { State } from "./application-state";

export const [lens, LensProvider] = stateless<State>();
```

```tsx
// App.tsx

import { State } from './application-state';
import { Root } from './Root';
import { lens, LensProvider } from './LensProvider';

export const App = () => {
  const state: State = { ... };

  <LensProvider value={state} onChange={...}>
    <Root state={lens} />
  </LensProvider>
}
```

The lens can be focused by regular member access.

```tsx
// Root.tsx

import { Lens } from "concave";
import { State } from "./application-state";
import { Profile } from "./Profile";

type Props = {
  state: Lens<State>;
};

export const Root = (props: Props) => {
  return <Profile state={props.state.user.profile} />;
};
```

And then the underlying data it can be accessed by collapsing the lens into a React hook with `use`.

````tsx
// Profile.tsx
import { Lens } from "concave";

type Props = {
  state: Lens<{ name: string; email: string }>;
};

const Profile = (props: Props) => {
  const [name, updateProfileName] = props.state.name.use();
  const [email, updateProfileEmail] = props.state.email.use();

  return (
    <>
      <input type="text" value={name} onChange={(ev) => updateProfileName(() => ev.target.value)} />
      <input type="email" value={email} onChange={(ev) => updateProfileEmail(() => ev.target.value)} />
    </>
  );
};
``` -->

```

```
