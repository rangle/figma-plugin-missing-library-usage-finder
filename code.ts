// Figma needs all code in a single file and does not support imports
// For now it's ok to keep all in a file but we might need to add
// a build step later

type PageFinds = { page: PageNode; instances: InstanceNode[] };

type PageStyleFinds = {
  page: PageNode;
  instances: Array<[BaseStyle, string, BaseNode]>;
};

type StyleProps = (typeof stylesProps)[number];

type InstanceMeta = {
  id: string;
  name: string;
  /** Only for Styles */
  styleName?: string;
  /** Only for Styles */
  styleId?: string;
  /** Only for Styles */
  styleProp?: string;
};

type Result = [{ pageId: string; pageName: string }, InstanceMeta[]];

type InstancesAndStyles = {
  instances: InstanceNode[];
  styles: {
    node: FrameNode | ComponentNode;
    styleProp: StyleProps;
  }[];
};

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

/** Resolves Variants and children to the top ComponentNode in a Component  */
const getParent = (node: BaseNode): BaseNode => {
  if (node.parent === null) {
    return node;
  }
  return getParent(node.parent);
};

/** Helper to get all components that are instances of names in `componentNames` */
const getInstanceOfComponents = (componentNames: string[]): InstanceNode[] => {
  return figma.root.findAll((node) => {
    if (node.type !== "INSTANCE" || node.mainComponent?.name === undefined) {
      return false;
    }
    const mainComponentNodeName = getParent(node.mainComponent).name;
    return componentNames.includes(mainComponentNodeName);
  }) as InstanceNode[];
};

/** Helper to find usage of Components */
const findMissingLibraryComponentUsages = (componentNames: string[]) =>
  getInstanceOfComponents(componentNames)
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

/** Helper to signal UI that instance was detached */
const confirmDetach = (instanceId: string, styleProp?: string) => {
  figma.ui.postMessage({
    type: "confirm-detach",
    instanceId,
    ...(styleProp ? { styleProp } : {}),
  });
};

/** Detach component instance and report to UI */
const detachInstance = (node: InstanceNode) => {
  const instanceId = node.id;
  console.log("detach instance-node", instanceId);
  node.detachInstance();
  confirmDetach(instanceId);
};

/** Detach style and report to UI */
const detachStyle = (
  node: FrameNode | ComponentNode,
  styleProp: StyleProps
) => {
  const instanceId = node.id;
  console.log(
    `detach ${node.type.toLowerCase()}-node style`,
    instanceId,
    styleProp
  );
  (node as FrameNode | ComponentNode)[styleProp as StyleProps] = "";
  confirmDetach(instanceId, styleProp);
};

/** Extract flattened `instances` and `styles` from `nodes` */
const getInstancesAndStyles = (nodes: Result[]) => {
  return nodes.reduce<InstancesAndStyles>(
    (acc, [_, simpleInstances]) => {
      simpleInstances.forEach(({ id, styleId, styleProp }) => {
        const node = figma.getNodeById(id);
        if (!node) {
          return;
        }
        if (styleId === undefined) {
          acc.instances.push(node as InstanceNode);
        } else if (styleProp !== undefined) {
          acc.styles.push({
            node: node as FrameNode | ComponentNode,
            styleProp: styleProp as StyleProps,
          });
        }
      });
      return acc;
    },
    { instances: [], styles: [] }
  );
};

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

  let result: Result[] = Object.entries(nodes).map(
    ([pageName, { page, instances }]) => [
      {
        pageId: page.id,
        pageName: page.name,
      },
      instances.map((i) => ({
        id: i.id,
        name: i.name,
      })),
    ]
  );

  Object.entries(styleUsages).forEach(([pageName, { page, instances }]) => {
    const simpleInstances = instances.map<InstanceMeta>(
      ([style, styleProp, i]) => ({
        id: i.id,
        name: i.name,
        styleProp,
        styleId: style.id,
        styleName: style.name,
      })
    );

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
    detachInstance(node as InstanceNode);
    return;
  }
  // Detach Style
  detachStyle(node as FrameNode | ComponentNode, styleProp as StyleProps);
};

const handleDetachAll = (nodes: Result[]) => {
  const { instances, styles } = getInstancesAndStyles(nodes);

  // styles need to be detached first as detached instance may change
  // references and some styles may be contained in them
  styles.forEach(({ node, styleProp }) => detachStyle(node, styleProp));
  instances.forEach(detachInstance);
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
    case "detach-all": {
      handleDetachAll(msg.nodes);
      return;
    }
    default: {
      console.error(`${msg.type} is not implemented`, msg);
    }
  }
};
