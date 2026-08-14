# language-css

CSS language support.

## Features

- **Grammars**: provides Tree-sitter grammars built from [tree-sitter-css](https://github.com/tree-sitter/tree-sitter-css) and TextMate grammars derived from [atom/language-css](https://github.com/atom/language-css).
- **Syntax highlighting**: full grammar coverage for CSS files.
- **Completions**: suggestions for properties, values, and selectors while typing.
- **Snippets**: shortcuts for common rules and at-rules.

## Installation

To install `language-css` search for it in the Install pane of the Lumine settings, or run the command `lumine --install lumine-code/language-css`.

## Services

- `hyperlink.injection`: consumed to highlight URLs inside stylesheets as clickable links.
- `todo.injection`: consumed to highlight `TODO`-style markers inside comments.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
