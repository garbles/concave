# Lenses in React

Uses TypeScript and [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) to dynamically construct a lens-like interface for your application state.

## Example

You can construct a lens/React Provider by just providing the shape of your application state

```ts
// LensProvider.ts

import { create } from "concave";
import type { State } from "./application-state";

export const { lens, LensProvider } = create<State>();
```

The lens itself is provided via a `children` function to `LensProvider`.

```tsx
// App.tsx

import type { State } from './application-state';
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
import type { State } from "./application-state";
import { Profile } from "./Profile";

type Props = {
  state: Lens<State>;
};

export const Root = (props: Props) => {
  return <Profile state={props.state.user.profile} />;
};
```

And then the underlying data it can be accessed by collapsing the lens into a React hook with `use`.

```tsx
// Profile.tsx
import { Lens } from "concave";

type Props = {
  state: Lens<{ name: string; email: string }>;
};

const Profile = (props: Props) => {
  const [profile, updateProfile] = props.state.use();

  return <input type="text" value={profile.name} onChange={(ev) => updateProfile(() => ev.target.value)} />;
};
```
