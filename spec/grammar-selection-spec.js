// A stylesheet modeline and an ordinary extension resolve to the same parser.

describe("CSS grammar selection", () => {
  beforeEach(async () => {
    await lumine.packages.activatePackage("language-css");
  });

  it("prefers the Tree-sitter grammar for a file with a modeline", () => {
    const grammar = lumine.grammars.selectGrammar("sample.css", "/* -*- mode: css -*- */\na {}\n");

    expect(grammar.scopeName).toBe("source.css");
    expect(grammar.constructor.name).toBe("TreeSitterGrammar");
  });

  it("prefers the Tree-sitter grammar for a file without one", () => {
    const grammar = lumine.grammars.selectGrammar("sample.css", "a {}\n");

    expect(grammar.scopeName).toBe("source.css");
    expect(grammar.constructor.name).toBe("TreeSitterGrammar");
  });
});
