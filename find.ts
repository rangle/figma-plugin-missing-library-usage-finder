// export const findMissingLibraryUsages = (componentOrStyleNames: string[]) => {};

export const findMissingLibraryComponentUsages = (componentNames: string[]) => {
  let currentPage;

  let finds = figma.root.findAll(
    (n) =>
      n.type === "INSTANCE" &&
      !!n.mainComponent?.name &&
      componentNames.includes(n.mainComponent?.name)
  );

  if (finds.length > 0) {
    console.log(finds);
    // const [page, node] = finds[0];
    // console.log(`Found result on ${page.name}: ${node.name}`);
    // console.log(node);
    // // showing first result
    // figma.currentPage = page;
    // page.selection = [node];
  }
};

// export const findMissingLibraryStyleUsages = (styleNames: string[]) => {
//   // // Returns the list of local paint styles.
//   // let localStyles = [
//   //   ...figma.getLocalPaintStyles(),
//   //   ...figma.getLocalTextStyles(),
//   //   ...figma.getLocalEffectStyles(),
//   //   ...figma.getLocalGridStyles(),
//   // ];

//   const isMissingStyle = (node, prop) => {
//     if (prop in node) {
//       const styleName = figma.getStyleById(node[prop].toString())?.name;
//       return componentNames.includes(styleName) ? styleName : undefined;
//     }
//   };

//   const stylesProps = [
//     "backgroundStyleId",
//     "effectStyleId",
//     "fillStyleId",
//     "gridStyleId",
//     "strokeStyleId",
//   ];

//   let styledNodes = figma.root.findAll(
//     (n) =>
//       stylesProps.every((v) => v in n) && stylesProps.some((v) => n[v] !== "")
//   );

//   const missingFrameAndInstanceStyles = styledNodes.flatMap((node) => {
//     return stylesProps.flatMap((style) => {
//       const mayBeStyleName = isMissingStyle(node, style);
//       if (mayBeStyleName) {
//         console.log(mayBeStyleName, node);
//         return [[mayBeStyleName, node]];
//       }
//       return [];
//     });
//   });

//   /** @type {TextNode[]} */
//   let textNodes = figma.root.findAll(
//     (node) => "textStyleId" in node && node.textStyleId !== ""
//   );

//   const missingTextNodeStyle = textNodes.flatMap((node) => {
//     const textStyleId = figma.getStyleById(node.textStyleId.toString())?.name;
//     if (textStyleId && componentNames.includes(textStyleId)) {
//       console.log(textStyleId, node);
//       return [[, node]];
//     }
//     return [];
//   });

//   const allStylesByName = [
//     ...missingFrameAndInstanceStyles,
//     ...missingTextNodeStyle,
//   ].reduce((acc, [styleName, node]) => {
//     return {
//       ...acc,
//       [styleName]: [...(acc[styleName] ?? []), node],
//     };
//   }, {});

//   console.log("done finding styles...");
//   console.log(allStylesByName);
// };
