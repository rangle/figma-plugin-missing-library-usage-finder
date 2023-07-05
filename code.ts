// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// This shows the HTML page in "ui.html".
figma.showUI(__html__, { height: 500, width: 350, themeColors: true });

const getPage = (node: BaseNode): PageNode | undefined => {
  if (node.parent?.type === "PAGE") {
    return node.parent;
  }
  return node.parent ? getPage(node.parent) : undefined;
};

type PageFinds = { page: PageNode; instances: InstanceNode[] };
const findMissingLibraryComponentUsages = (componentNames: string[]) => {
  return (
    figma.root.findAll(
      (n) =>
        n.type === "INSTANCE" &&
        !!n.mainComponent?.name &&
        componentNames.includes(n.mainComponent?.name)
    ) as InstanceNode[]
  )
    .map((f): [PageNode | undefined, InstanceNode] => [getPage(f), f])
    .reduce<Record<string, PageFinds>>((acc, [page, find]) => {
      if (!page) {
        return acc;
      }
      if (acc[page.name]) {
        acc[page.name].instances.push(find);
        return acc;
      }
      return {
        ...acc,
        [page.name]: {
          page,
          instances: [find],
        },
      };
    }, {});
};

type StyledNode = FrameNode | ComponentNode | InstanceNode;
type PageStyleFinds = {
  page: PageNode;
  instances: Array<[BaseStyle, string, StyledNode | TextNode]>;
};

/** All styles for non-text nodes */
const stylesProps = [
  "backgroundStyleId",
  "fillStyleId",
  "strokeStyleId",
  "gridStyleId",
  "effectStyleId",
] as const;
type StyleProps = (typeof stylesProps)[number];

const findMissingLibraryStyleUsages = (styleNames: string[]) => {
  /** returns the style only if it's missing */
  const getMissingStyle = (node: StyledNode, prop: StyleProps) => {
    if (prop in node) {
      const style = figma.getStyleById(node[prop].toString());
      return style && styleNames.includes(style.name) ? style : undefined;
    }
    return undefined;
  };

  let styledNodes = figma.root.findAll(
    (n) =>
      stylesProps.every((v) => v in n) &&
      stylesProps.some((v) => (n as StyledNode)[v] !== "")
  ) as Array<StyledNode>;

  const missingFrameAndInstanceStyles = styledNodes.flatMap((node) => {
    return stylesProps.flatMap<
      [PageNode | undefined, BaseStyle, string, StyledNode]
    >((styleProp) => {
      const missingStyle = getMissingStyle(node, styleProp);
      if (missingStyle) {
        return [[getPage(node), missingStyle, styleProp, node]];
      }
      return [];
    });
  });

  console.log(
    ">>> missingFrameAndInstanceStyles",
    missingFrameAndInstanceStyles
  );

  let textNodes = figma.root.findAll(
    (node) => "textStyleId" in node && node.textStyleId !== ""
  ) as TextNode[];

  const missingTextNodeStyle = textNodes.flatMap<
    [PageNode | undefined, BaseStyle, string, TextNode]
  >((node) => {
    const style = figma.getStyleById(node.textStyleId.toString());
    if (style && styleNames.includes(style.name)) {
      return [[getPage(node), style, "textStyleId", node]];
    }
    return [];
  });

  return [...missingFrameAndInstanceStyles, ...missingTextNodeStyle].reduce<
    Record<string, PageStyleFinds>
  >((acc, [page, style, styleProp, node]) => {
    if (!page) {
      return acc;
    }
    if (acc[page.name]) {
      acc[page.name].instances = [
        ...acc[page.name].instances,
        [style, styleProp, node],
      ];
      return acc;
    }
    return {
      ...acc,
      [page.name]: {
        page,
        instances: [[style, styleProp, node]],
      },
    };
  }, {});
};

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
figma.ui.onmessage = (msg, props) => {
  // One way of distinguishing between different types of messages sent from
  // your HTML page is to use an object with a "type" property like this.
  if (msg.type === "find-missing-library-usage") {
    console.log("searching...");
    const nodes = findMissingLibraryComponentUsages(msg.search);
    const styleUsages = findMissingLibraryStyleUsages(msg.search);

    console.log(">>> nodes", nodes);
    console.log(">>> styleUsages", styleUsages);

    // Auto select/zoom
    // // console.log(styleUsages);
    // let containsCurrentPage = false;
    // Object.values(nodes).forEach(({ page, instances }) => {
    //   // select
    //   page.selection = instances;
    //   if (figma.currentPage === page) {
    //     figma.viewport.scrollAndZoomIntoView(instances);
    //     containsCurrentPage = true;
    //   }
    // });

    // if (!containsCurrentPage && Object.values(nodes).length > 0) {
    //   const { page, instances } = Object.values(nodes)[0];
    //   figma.currentPage = page;
    //   figma.viewport.scrollAndZoomIntoView(instances);
    // }

    type Result = { id: string; name: string; styleName?: string };

    let result: Array<[{ pageId: string; pageName: string }, Array<Result>]> =
      Object.entries(nodes).map(([pageName, { page, instances }]) => [
        {
          pageId: page.id,
          pageName: page.name,
        },
        instances.map((i) => ({
          id: i.id,
          name: i.name,
        })),
      ]);

    Object.entries(styleUsages).forEach(([pageName, { page, instances }]) => {
      console.log(">>>", page, instances);
      const simpleInstances = instances.map(([style, styleProp, i]) => ({
        id: i.id,
        name: i.name,
        styleProp,
        styleId: style.id,
        styleName: style.name,
      }));

      const currentPageIndex = result.findIndex((p) => p[0].pageId === page.id);

      if (currentPageIndex >= 0) {
        result[currentPageIndex][1].push(...simpleInstances);
        return;
      }

      result.push([
        {
          pageId: page.id,
          pageName: page.name,
        },
        simpleInstances,
      ]);
    });

    console.log(">>>> result", result);

    figma.ui.postMessage({ type: "result", nodes: result });
  }

  if (msg.type === "focus-instance") {
    const { pageId, instanceId } = msg;
    const page = figma.getNodeById(pageId) as PageNode;
    const node = figma.getNodeById(instanceId) as SceneNode;
    if (!page || !node) {
      const error = `Could not find ${
        !page ? "Page" : "Node"
      } with ID: ${instanceId}`;
      console.error(error);
      figma.ui.postMessage({ type: "error", error });
      return;
    }

    page.selection = [node];
    figma.currentPage = page;
    figma.viewport.scrollAndZoomIntoView([node]);
  }

  if (msg.type === "detach-instance") {
    const { pageId, instanceId, styleId, styleProp } = msg;
    // const page = figma.getNodeById(pageId) as PageNode;
    const node = figma.getNodeById(instanceId) as StyledNode;
    console.log(">> detach-instance", msg, node);
    if (styleId) {
      (node as FrameNode | ComponentNode)[styleProp as StyleProps] = "";
      figma.ui.postMessage({
        type: "confirm-detach",
        instanceId,
        styleProp,
      });
    } else {
      (node as InstanceNode).detachInstance();
      figma.ui.postMessage({
        type: "confirm-detach",
        instanceId,
      });
    }
  }

  if (msg.type === "cancel") {
    // Make sure to close the plugin when you're done. Otherwise the plugin will
    // keep running, which shows the cancel button at the bottom of the screen.
    figma.closePlugin();
  }
};
