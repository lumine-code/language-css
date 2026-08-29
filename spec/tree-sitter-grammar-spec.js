const path = require("path");

describe("WASM Tree-sitter CSS grammar", () => {
  beforeEach(async () => {
    await lumine.packages.activatePackage("language-css");
  });

  it("passes grammar tests", async () => {
    await runGrammarTests(path.join(__dirname, "fixtures", "sample.css"), /\/\*/, /\*\//);
    await runGrammarTests(path.join(__dirname, "fixtures", "ends-in-tag-name.css"), /\/\*/, /\*\//);
  });

  it("keeps argument, var, URL, and incomplete-value scopes with leaf-rooted queries", async () => {
    const editor = await lumine.workspace.open();
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

  it("injects unquoted hyperlinks only into url() calls", () => {
    const main = require("../lib/main");
    const injectionPoints = [];
    main.consumeHyperlinkInjection({
      addInjectionPoint(_scopeName, options) {
        injectionPoints.push(options);
      },
    });

    const callInjection = injectionPoints.find((point) => point.types.includes("call_expression"));
    const nodeForCall = (name) => ({
      descendantsOfType(type) {
        if (type === "function_value") return [{ text: name }];
        if (type === "plain_value") return [{ text: "value" }];
        return [];
      },
    });

    expect(callInjection.content(nodeForCall("url"))).toEqual([{ text: "value" }]);
    expect(callInjection.content(nodeForCall("rgb"))).toBeNull();
    expect(callInjection.content(nodeForCall("var"))).toBeNull();
  });
});
