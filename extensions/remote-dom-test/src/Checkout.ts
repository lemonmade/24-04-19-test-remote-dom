import { extension } from "./remote-dom-ui-extensions";

export default extension("purchase.checkout.block.render", (root, api) => {
  const { extension, i18n } = api;

  const banner = document.createElement("ui-banner");
  banner.setAttribute("title", "remote-dom-test");
  banner.textContent = i18n.translate("welcome", { target: extension.target });

  root.append(banner);
});
