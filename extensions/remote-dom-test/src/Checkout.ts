import { extension } from "./remote-dom-ui-extensions";

import { h, render } from "preact";
import { useComputed, useSignal } from "@preact/signals";

export default extension("purchase.checkout.block.render", (root, api) => {
  const banner = document.createElement("ui-banner");
  banner.setAttribute("title", "remote-dom-test");

  root.append(banner);

  render(h(App, {}), banner);
});

function App() {
  const count = useSignal(0);
  const countText = useComputed(() => `Count: ${count.value}`);

  return h(
    "ui-block-stack",
    { spacing: "base" },
    countText,
    h(
      "ui-button",
      {
        onPress: () => {
          count.value += 1;
        },
      },
      "Click me!",
    ),
  );
}
