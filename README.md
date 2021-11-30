# Lenses in React

Uses TypeScript and [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) to dynamically construct a lens-like interface for your application state.

## Example

You can construct a lens/React Provider by just providing the shape of your application state

```ts
// LensProvider.ts

import { create } from "react-lenses";
import type { State } from "./application-state";

const { LensProvider } = create<State>();

export { LensProvider };
```

The lens itself is provided via a `children` function to `LensProvider`. This is an intentional decision to encourage using the lens as a prop from the root of your application UI.

```tsx
// App.tsx

import type { State } from './application-state';
import { Root } from './Root';
import { LensProvider } from './LensProvider';

export const App = () => {
  const state: State = { ... };

  <LensProvider value={state} onChange={...}>
    {lens => {
      <Root state={lens} />
    }}
  </LensProvider>
}
```

The lens can be focused by regular member access.

```tsx
// Root.tsx

import { Lens } from "react-lenses";
import type { State } from "./application-state";
import { Profile } from "./Profile";

type Props = {
  state: Lens<State>;
};

export const Root = (props: Props) => {
  return <Profile state={props.state.user.profile} />;
};
```

And then the underlying data it can be accessed by collapsing the lens into a React hook with `useState`.

```tsx
// Profile.tsx

type Props = {
  state: Lens<{ name: string; email: string }>;
};

const Profile = (props: Props) => {
  const [profile, setProfile] = props.state.useState();

  return <input type="text" value={profile.name} onChange={(ev) => setProfile(ev.target.value)} />;
};
```
