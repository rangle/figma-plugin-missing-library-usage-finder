# Figma Plugin: Missing Library Usage Finder

Figma Plugin to find instances or styles by name, e.g. to find missing library usage.

<img
 src="https://raw.githubusercontent.com/rangle/figma-plugin-missing-library-usage-finder/readme-assets/images/Plugin%20on%20Red.png"
 alt="Screenshot of the Plugin showing the result of for searching multiple components and styles"
 height="500" />

## Example Usage

### Use Case 1: Remove missing libraries

- View missing libraries via _Assets_ > _Library_ (Book Icon). You'll see _Includes X missing libraries_ at the bottom when you have missing libraries,
click it to view the components and styles in use from missing libraries.
  ![Screenshot with the path of the text above - how to list missing library links](https://raw.githubusercontent.com/rangle/figma-plugin-missing-library-usage-finder/readme-assets/images/Path%20to%20view%20missing%20library%20components%20and%20styles.png)


- Open the _Missing Library Usage Finder_ plugin, enter the names of the styles you want to search for, separated by line-breaks.
- Press _Search_, note that this might take a while for larger design files.
- If the plugin finds uses of the styles or components they get listed below and you can navigate to the find and/or unlink/detach it directly.

![Screenshot with the path of the text above](https://raw.githubusercontent.com/rangle/figma-plugin-missing-library-usage-finder/readme-assets/images/Finding%20missing%20library%20styles.png)

### Use Case 2: Unlink unwanted library

- Open unwanted library, e.g. via _Assets_ > _Library_ (Book Icon), then hover over the library name and click _Open File_.
  ![Screenshot with the path of the text above - how to get to the unwanted library](https://raw.githubusercontent.com/rangle/figma-plugin-missing-library-usage-finder/readme-assets/images/Path%20to%20view%20unwanted%20library.png)
  
- Once in the unwanted library open the [_Library Style Detail Extractor_](https://github.com/rangle/figma-plugin-library-style-detail-extractor) plugin and click _Extract Names_, and then _Copy Names to Clipboard_.
  ![Screenshot with the Library Style Detail Extractor plugin](https://raw.githubusercontent.com/rangle/figma-plugin-missing-library-usage-finder/readme-assets/images/Library%20Style%20Detail%20Extractor.png)

- Go back to the initial design file, open the _Missing Library Usage Finder_ plugin
- Paste the copied names and click _Search_. Note that this might take a while for larger design files.
- If the plugin finds uses of the styles or components they get listed below and you can navigate to the find and/or unlink/detach it directly.

![Screenshot with the path of the text above](https://raw.githubusercontent.com/rangle/figma-plugin-missing-library-usage-finder/readme-assets/images/Finding%20unwanted%20library%20styles.png)

