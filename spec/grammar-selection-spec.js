// A first-line match is worth 0.5 to a grammar's score, and preferring
// Tree-sitter is worth only 0.1. So whenever a TextMate grammar declares
// `firstLineMatch` and its Tree-sitter twin declares no `firstLineRegex`, every
// file whose first line matches quietly gets the TextMate grammar — here, a
// stylesheet that opens with an editor modeline.

describe("CSS grammar selection", () => {
  beforeEach(async () => {
    await lumine.packages.activatePackage("language-css");
    lumine.config.set("language.useTreeSitterParsers", true);
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

  it("still honours the TextMate preference", () => {
    lumine.config.set("language.useTreeSitterParsers", false);

    const grammar = lumine.grammars.selectGrammar("sample.css", "/* -*- mode: css -*- */\na {}\n");

    expect(grammar.scopeName).toBe("source.css");
    expect(grammar.constructor.name).toBe("Grammar");
  });
});
