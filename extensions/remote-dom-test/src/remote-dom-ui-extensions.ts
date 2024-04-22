// This file contains the code we’d put in `@shopify/ui-extensions`, which
// replaces the current remote-ui “registration” mechanism with a new
// one powered by Remote DOM.

import "@remote-dom/core/polyfill";
import { REMOTE_ID, type RemoteNodeSerialization } from "@remote-dom/core";
import {
  createRemoteElement,
  RemoteRootElement,
} from "@remote-dom/core/elements";
import type {
  ExtensionTarget,
  ApiForExtension,
  RenderExtensionConnection,
} from "@shopify/ui-extensions/checkout";

// Remote DOM expects you to define custom elements to represent UI
// components, so we define a minimal subset of those components here.
const Button = createRemoteElement({
  properties: {
    onPress: { event: true },
  },
});

const Banner = createRemoteElement({
  properties: {
    title: { type: String },
  },
});

const BlockStack = createRemoteElement({
  properties: {
    spacing: { type: String },
  },
});

customElements.define("remote-root", RemoteRootElement);
customElements.define("ui-button", Button);
customElements.define("ui-banner", Banner);
customElements.define("ui-block-stack", BlockStack);

declare global {
  interface HTMLElementTagNameMap {
    "remote-root": InstanceType<typeof RemoteRootElement>;
    "ui-button": InstanceType<typeof Button>;
    "ui-banner": InstanceType<typeof Banner>;
    "ui-block-stack": InstanceType<typeof BlockStack>;
  }
}

const ELEMENT_MAPPING = new Map<string, string>([
  ["ui-button", "Button"],
  ["ui-banner", "Banner"],
  ["ui-block-stack", "BlockStack"],
]);

export function extension<Target extends ExtensionTarget>(
  target: Target,
  callback: (
    element: RemoteRootElement,
    api: ApiForExtension<Target>,
  ) => void | Promise<void>,
) {
  shopify.extend(
    target,
    async (connection: RenderExtensionConnection, api: any) => {
      const root = document.createElement("remote-root");

      await callback(root, api);

      // remote-ui and Remote DOM have slightly different ways of communicating
      // operations over the RPC bridge. Additionally, remote-ui has the notion
      // of “mounting”, where updates are not sent to the host until the
      // developer is done building their initial tree of UI. Here, we simulate
      // the remote-ui behavior by:
      //
      // 1. Manually sending the `mount` operation code (`connection.channel(0, [])`)
      // 2. Mapping the new operations created by Remote DOM, to the remote-ui ones
      // our hosts expect.
      connection.channel(0, []);
      root.connect({
        mutate(records) {
          for (const record of records) {
            switch (record[0]) {
              // insert child
              case 0: {
                const [, id, child, index] = record;
                connection.channel(
                  1,
                  normalizeId(id),
                  index,
                  normalizeNode(child),
                  false,
                );
                break;
              }
              // remove child
              case 1: {
                const [, id, index] = record;
                connection.channel(2, normalizeId(id), index);
                break;
              }
              // update text
              case 2: {
                const [, id, text] = record;
                connection.channel(3, id, text);
                break;
              }
              // update property
              case 3: {
                const [, id, property, value] = record;
                connection.channel(4, normalizeId(id)!, { [property]: value });
                break;
              }
            }
          }
        },
        // Remote DOM provides a `call` method that allows instance
        // methods to be invoked over the bridge. remote-ui has no
        // equivalent, and therefore none of our components depend on
        // this feature, so we just no-op it here.
        call() {},
      });

      function normalizeId(id: string) {
        return id === root[REMOTE_ID] ? undefined : id;
      }

      function normalizeNode(child: RemoteNodeSerialization): any {
        switch (child.type) {
          case 1: {
            return {
              id: child.id,
              kind: 1,
              type: ELEMENT_MAPPING.get(child.element),
              props: child.properties ?? {},
              children: child.children.map(normalizeNode),
            };
          }
          case 3: {
            return { id: child.id, kind: 2, text: child.data };
          }
          default: {
            throw new Error(`Unsupported child: ${child.type}`);
          }
        }
      }
    },
  );
}
