---
name: Expandable sections and test accessibility
description: Conditionally-rendered expandable section content hides testIDs from tests unless the section starts expanded.
---

## Rule

When content is wrapped in `{expandedSections.has("key") && (...)}`, jest tests that try to `getByTestId(...)` inside that section will fail with "unable to find element" if the section starts collapsed.

**Why:** The analysis screen uses `expandedSections` state to show/hide sections. Tests render the component and immediately query testIDs without triggering the expand toggle.

**How to apply:**

Option A (preferred for important interactive sections): Include the section key in the initial `expandedSections` state:
```ts
const [expandedSections, setExpandedSections] = useState<Set<string>>(
  new Set(["coaching-tips", "movement", "joints"])
);
```

Option B: Have the test fire the toggle before querying:
```ts
fireEvent.press(getByText("Movement Quality"));
await flush();
fireEvent.press(getByTestId("movement-dim-flow"));
```

Currently `"coaching-tips"`, `"movement"`, and `"joints"` start expanded in `analysis/[id].tsx`.
