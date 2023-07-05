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
  instances: Array<[string, StyledNode | TextNode]>;
};
const findMissingLibraryStyleUsages = (styleNames: string[]) => {
  const stylesProps = [
    "backgroundStyleId",
    "effectStyleId",
    "fillStyleId",
    "gridStyleId",
    "strokeStyleId",
  ] as const;
  type StyleProps = (typeof stylesProps)[number];

  const isMissingStyle = (node: StyledNode, prop: StyleProps) => {
    if (prop in node) {
      const styleName = figma.getStyleById(node[prop].toString())?.name;
      return styleNames.includes(styleName ?? "") ? styleName : undefined;
    }
  };

  let styledNodes = figma.root.findAll(
    (n) =>
      stylesProps.every((v) => v in n) &&
      stylesProps.some((v) => (n as StyledNode)[v] !== "")
  ) as Array<StyledNode>;

  const missingFrameAndInstanceStyles = styledNodes.flatMap((node) => {
    return stylesProps.flatMap<[PageNode | undefined, string, StyledNode]>(
      (style) => {
        const mayBeStyleName = isMissingStyle(node, style);
        if (mayBeStyleName) {
          return [[getPage(node), mayBeStyleName, node]];
        }
        return [];
      }
    );
  });

  let textNodes = figma.root.findAll(
    (node) => "textStyleId" in node && node.textStyleId !== ""
  ) as TextNode[];

  const missingTextNodeStyle = textNodes.flatMap<
    [PageNode | undefined, string, TextNode]
  >((node) => {
    const textStyleId = figma.getStyleById(node.textStyleId.toString())?.name;
    if (textStyleId && styleNames.includes(textStyleId)) {
      return [[getPage(node), textStyleId, node]];
    }
    return [];
  });

  const allStylesByName = [
    ...missingFrameAndInstanceStyles,
    ...missingTextNodeStyle,
  ].reduce<Record<string, PageStyleFinds>>((acc, [page, styleName, node]) => {
    if (!page) {
      return acc;
    }
    if (acc[page.name]) {
      acc[page.name].instances = [
        ...acc[page.name].instances,
        [styleName, node],
      ];
      return acc;
    }
    return {
      ...acc,
      [page.name]: {
        page,
        instances: [[styleName, node]],
      },
    };
  }, {});

  return allStylesByName;
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

    // console.log(styleUsages);
    let containsCurrentPage = false;
    Object.values(nodes).forEach(({ page, instances }) => {
      // select
      page.selection = instances;
      if (figma.currentPage === page) {
        figma.viewport.scrollAndZoomIntoView(instances);
        containsCurrentPage = true;
      }
    });

    if (!containsCurrentPage) {
      const { page, instances } = Object.values(nodes)[0];
      figma.currentPage = page;
      figma.viewport.scrollAndZoomIntoView(instances);
    }

    console.log("styleUsages", styleUsages);
    let result: Array<
      [
        { pageId: string; pageName: string },
        Array<{ id: string; name: string; styleName?: string }>
      ]
    > = Object.entries(nodes).map(([pageName, { page, instances }]) => {
      return [
        {
          pageId: page.id,
          pageName: page.name,
        },
        instances.map((i) => ({
          id: i.id,
          name: i.name,
        })),
      ];
    });

    Object.entries(styleUsages).forEach(([pageName, { page, instances }]) => {
      result.push([
        {
          pageId: page.id,
          pageName: page.name,
        },
        instances.map(([styleName, i]) => ({
          id: i.id,
          name: i.name,
          styleName,
        })),
      ]);
    });

    console.log(">>> result", result);

    figma.ui.postMessage({ type: "result", nodes: result });
  }

  if (msg.type === "focus-instance") {
    const { pageId, instanceId } = msg;
    const page = figma.getNodeById(pageId) as PageNode;
    const node = figma.getNodeById(instanceId) as SceneNode;

    page.selection = [node];
    figma.currentPage = page;
    figma.viewport.scrollAndZoomIntoView([node]);
  }
  if (msg.type === "cancel") {
    // Make sure to close the plugin when you're done. Otherwise the plugin will
    // keep running, which shows the cancel button at the bottom of the screen.
    figma.closePlugin();
  }
};
