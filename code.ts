type PageFinds = { page: PageNode; instances: InstanceNode[] };

type PageStyleFinds = {
  page: PageNode;
  instances: Array<[BaseStyle, string, BaseNode]>;
};
type StyleProps = (typeof stylesProps)[number];

/** All props with styles for non-text nodes */
const stylesProps = [
  "backgroundStyleId",
  "fillStyleId",
  "strokeStyleId",
  "gridStyleId",
  "effectStyleId",
  // textStyleId handed separately
] as const;

// This shows the HTML page in "ui.html".
figma.showUI(__html__, { height: 500, width: 350, themeColors: true });

/** Helper to get the Page a node is contained in */
const getPage = (node: BaseNode): PageNode | undefined => {
  if (node.parent?.type === "PAGE") {
    return node.parent;
  }
  return node.parent ? getPage(node.parent) : undefined;
};

/** Helper to find usage of Components */
const findMissingLibraryComponentUsages = (componentNames: string[]) =>
  (
    figma.root.findAll(
      (n) =>
        n.type === "INSTANCE" &&
        !!n.mainComponent?.name &&
        componentNames.includes(n.mainComponent?.name)
    ) as InstanceNode[]
  )
    .map((node): [PageNode | undefined, InstanceNode] => [getPage(node), node])
    .reduce<Record<string, PageFinds>>((acc, [page, node]) => {
      if (!page) {
        return acc;
      }
      if (acc[page.name]) {
        acc[page.name].instances.push(node);
        return acc;
      }
      return {
        ...acc,
        [page.name]: {
          page,
          instances: [node],
        },
      };
    }, {});

/** Helper to find usage of Styles */
const findMissingLibraryStyleUsages = (styleNames: string[]) => {
  /** returns the style only if it's missing */
  const getMissingStyle = (node: BaseNode, styleProp: StyleProps) => {
    if (!(styleProp in node)) {
      return undefined;
    }
    const propVal = (
      node as { [index in StyleProps]: { toString: () => string } }
    )[styleProp];
    const style = figma.getStyleById(propVal.toString());
    return style && styleNames.includes(style.name) ? style : undefined;
  };

  let styledNodes = figma.root.findAll((node) =>
    stylesProps.some(
      (styleProp) =>
        styleProp in node &&
        (node as Record<typeof styleProp, unknown>)[styleProp] !== ""
    )
  ) as Array<BaseNode>;

  const missingFrameAndInstanceStyles = styledNodes.flatMap((node) => {
    return stylesProps.flatMap<
      [PageNode | undefined, BaseStyle, string, BaseNode]
    >((styleProp) => {
      if (!(styleProp in node)) {
        return [];
      }
      const missingStyle = getMissingStyle(node, styleProp);
      if (missingStyle) {
        return [[getPage(node), missingStyle, styleProp, node]];
      }
      return [];
    });
  });

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

/** Main handler for `find-missing-library-usage` */
const handleFindMissingLibraryUsage = (search: string[]) => {
  console.log("searching...");
  const nodes = findMissingLibraryComponentUsages(search);
  const styleUsages = findMissingLibraryStyleUsages(search);

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
  figma.ui.postMessage({ type: "result", nodes: result });
};

/** Main handler for `focus-instance` */
const handleFocusInstance = (pageId: string, instanceId: string) => {
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
};

/** Main handler for `detach-instance` */
const handleDetachInstance = (
  instanceId: string,
  styleId?: string,
  styleProp?: string
) => {
  const node = figma.getNodeById(instanceId);
  console.log(">> detach-instance", instanceId, styleId, styleProp, node);
  if (!styleId) {
    // Detach component instance
    (node as InstanceNode).detachInstance();
    figma.ui.postMessage({
      type: "confirm-detach",
      instanceId,
    });
    return;
  }
  // Detach Style
  (node as FrameNode | ComponentNode)[styleProp as StyleProps] = "";
  figma.ui.postMessage({
    type: "confirm-detach",
    instanceId,
    styleProp,
  });
};

figma.ui.onmessage = (msg, props) => {
  switch (msg.type) {
    case "find-missing-library-usage": {
      handleFindMissingLibraryUsage(msg.search);
      return;
    }
    case "focus-instance": {
      handleFocusInstance(msg.pageId, msg.instanceId);
      return;
    }
    case "detach-instance": {
      handleDetachInstance(msg.instanceId, msg.styleId, msg.styleProp);
      return;
    }
    case "cancel": {
      figma.closePlugin();
      return;
    }
    default: {
      console.error(`${msg.type} is not implemented`, msg);
    }
  }
};
