const path = require("path");

describe("WASM Tree-sitter CSS grammar", () => {
  let editor;

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-css");
  });

  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  async function setText(text) {
    editor ??= await lumine.workspace.open();
    editor.setGrammar(lumine.grammars.grammarForScopeName("source.css"));
    editor.setText(text);
    const mode = editor.getBuffer().getLanguageMode();
    await mode.ready;
    await mode.atGrammarSettlement();
    return mode;
  }

  function callInjection() {
    const points = [];
    const main = lumine.packages.getActivePackage("language-css").mainModule;
    main
      .consumeHyperlinkInjection({
        addInjectionPoint(_scope, options) {
          points.push(options);
          return { dispose() {} };
        },
      })
      .dispose();
    return points.find((point) => point.types.includes("call_expression"));
  }

  const hyperlinkLayers = (mode) =>
    mode.getAllInjectionLayers().filter((layer) => layer.grammar.scopeName === "text.hyperlink");

  it("passes grammar tests", async () => {
    await runGrammarTests(path.join(__dirname, "fixtures", "sample.css"), /\/\*/, /\*\//);
    await runGrammarTests(path.join(__dirname, "fixtures", "ends-in-tag-name.css"), /\/\*/, /\*\//);
  });

  it("keeps argument, var, URL, and incomplete-value scopes with context-aware queries", async () => {
    editor = await lumine.workspace.open();
    const text = "a { color: var(--accent); background: url(asset.png); color: red !i }";
    editor.setGrammar(lumine.grammars.grammarForScopeName("source.css"));
    editor.setText(text);
    await editor.languageMode.ready;

    const scopesAt = (needle, offset = 0) => {
      const index = text.indexOf(needle) + offset;
      const point = editor.getBuffer().positionForCharacterIndex(index);
      return editor.scopeDescriptorForBufferPosition(point).getScopesArray();
    };

    expect(scopesAt("var(", 3)).toContain(
      "punctuation.definition.arguments.begin.bracket.round.css",
    );
    expect(scopesAt("--accent")).toContain("variable.css");
    expect(scopesAt("asset.png")).toContain("string.unquoted.css");
    expect(scopesAt("!i")).toContain("meta.property-value.css");
  });

  it("uses actual function-name nodes for unquoted URLs, comments and incomplete calls", async () => {
    const point = callInjection();
    const url = "https://example.com/image.png";
    for (const text of [
      `@import url(${url});`,
      `a { background: URL(${url}); }`,
      `a { background: Url(${url}); }`,
      `a { background: /* before */url(${url}); }`,
      `a { background: url/* between */(${url}); }`,
      `a { background: url(/* inside */${url}); }`,
      `a { background: url(${url} }`,
    ]) {
      const mode = await setText(text);
      const calls = mode.tree.rootNode.descendantsOfType("call_expression");
      expect(calls.length).withContext(text).toBe(1);
      expect(calls[0].firstNamedChild.type).toBe("function_name");
      expect(point.content(calls[0]).map((node) => node.text))
        .withContext(text)
        .toEqual([url]);
    }
    const mode = await setText(`a { background: !url(${url}); }`);
    expect(mode.tree.rootNode.hasError).toBe(true);
    expect(mode.tree.rootNode.descendantsOfType("call_expression")).toEqual([]);
    for (const error of mode.tree.rootNode.descendantsOfType("ERROR"))
      expect(point.content(error)).toBeNull();
  });

  it("rejects non-URL functions locally and leaves a nested URL to its own call", async () => {
    const mode = await setText(
      "a { color: rgb(1,2,3); width: calc(var(--x)); background: calc(url(https://example.com/a)); }",
    );
    const point = callInjection();
    for (const node of mode.tree.rootNode.descendantsOfType("call_expression")) {
      if (node.firstNamedChild.text === "url") {
        expect(point.content(node).map((value) => value.text)).toEqual(["https://example.com/a"]);
      } else {
        spyOn(node, "descendantsOfType").and.callThrough();
        expect(point.content(node)).toBeNull();
        expect(node.descendantsOfType).not.toHaveBeenCalled();
      }
    }
  });

  it("colorizes unquoted import and property URLs through the actual hyperlink service", async () => {
    await lumine.packages.activatePackage("language-hyperlink");
    const text =
      "@import url(https://example.com/style.css);\na { background: URL(https://example.com/image.png); }";
    const mode = await setText(text);
    expect(hyperlinkLayers(mode).length).toBe(2);
    for (const url of ["https://example.com/style.css", "https://example.com/image.png"]) {
      const position = editor.getBuffer().positionForCharacterIndex(text.indexOf(url));
      expect(editor.scopeDescriptorForBufferPosition(position).getScopesArray()).toContain(
        "markup.underline.link.hyperlink",
      );
    }
  });

  it("does not add a call injection around a quoted URL or an outer non-URL function", async () => {
    await lumine.packages.activatePackage("language-hyperlink");
    const mode = await setText(
      '/* https://example.com/comment */ a { background: url("https://example.com/quoted.png"); mask: calc(url(https://example.com/nested.png)); }',
    );
    const point = callInjection();
    const calls = mode.tree.rootNode.descendantsOfType("call_expression");
    expect(point.content(calls[0])).toEqual([]);
    expect(point.content(calls[1])).toBeNull();
    expect(hyperlinkLayers(mode).length).toBe(3);
    expect(
      hyperlinkLayers(mode)
        .map((layer) => layer.injectionPoint.type)
        .sort(),
    ).toEqual(["call_expression", "comment", "string_value"]);
    for (const url of ["https://example.com/quoted.png", "https://example.com/comment"]) {
      const position = editor.getBuffer().positionForCharacterIndex(editor.getText().indexOf(url));
      expect(editor.scopeDescriptorForBufferPosition(position).getScopesArray()).toContain(
        "markup.underline.link.hyperlink",
      );
    }
  });

  it("updates URL layers and link scopes when the function name changes", async () => {
    await lumine.packages.activatePackage("language-hyperlink");
    const mode = await setText("a { background: var(https://example.com/image.png); }");
    expect(hyperlinkLayers(mode).length).toBe(0);
    const buffer = editor.getBuffer();
    const index = editor.getText().indexOf("var(");
    buffer.setTextInRange(
      [buffer.positionForCharacterIndex(index), buffer.positionForCharacterIndex(index + 3)],
      "url",
    );
    await mode.atTransactionEnd();
    expect(hyperlinkLayers(mode).length).toBe(1);
    const position = buffer.positionForCharacterIndex(editor.getText().indexOf("https://"));
    expect(editor.scopeDescriptorForBufferPosition(position).getScopesArray()).toContain(
      "markup.underline.link.hyperlink",
    );
    buffer.setTextInRange(
      [buffer.positionForCharacterIndex(index), buffer.positionForCharacterIndex(index + 3)],
      "var",
    );
    await mode.atTransactionEnd();
    expect(hyperlinkLayers(mode).length).toBe(0);
    expect(editor.scopeDescriptorForBufferPosition(position).getScopesArray()).not.toContain(
      "markup.underline.link.hyperlink",
    );
  });
});
