const path = require("node:path");

describe("css editing settings", () => {
  let editor;

  beforeEach(async () => {
    jasmine.useRealClock();
    const pack = await lumine.packages.activatePackage(path.resolve(__dirname, ".."));
    await pack.resourceLoadPromise;
    editor = await lumine.workspace.open();
    editor.setGrammar(lumine.grammars.grammarForScopeName("source.css"));
    editor.update({ autoIndent: false });
    await editor.whenGrammarSettled();
  });

  afterEach(() => editor?.destroy());

  async function setText(text) {
    editor.setText(text);
    expect(await editor.whenGrammarSettled()).toBe(true);
  }

  it("selects hyphenated properties as one word", async () => {
    await setText(".card { font-size: 1rem; }");
    editor.setCursorBufferPosition(
      editor.getBuffer().positionForCharacterIndex(editor.getText().indexOf("size") + 1),
    );
    editor.selectWordsContainingCursors();
    expect(editor.getSelectedText()).toBe("font-size");
  });

  it("classifies emitted tag, class and ID scopes as selector completions", async () => {
    const autocomplete = (await lumine.packages.activatePackage("autocomplete")).mainModule;
    const provider =
      await autocomplete.autocompleteManager.providerManager.defaultProvider.prepare(true);
    await setText("article, .card, #main { color: red; }");
    for (const token of ["article", "card", "main"]) {
      const position = [0, editor.getText().indexOf(token) + 1];
      expect(
        provider.providerConfig.scopeDescriptorToType(
          editor.scopeDescriptorForBufferPosition(position),
        ),
      )
        .withContext(token)
        .toBe("selector");
    }
  });

  it("pairs CSS syntax without adding backticks or prose smart quotes", async () => {
    await lumine.packages.activatePackage("bracket-matcher");
    for (const [typed, expected] of [
      ["(", "()"],
      ["[", "[]"],
      ["{", "{}"],
      ['"', '""'],
      ["'", "''"],
      ["`", "`"],
      ["“", "“"],
    ]) {
      await setText("");
      await editor.insertText(typed);
      await editor.whenGrammarSettled();
      expect(editor.getText()).withContext(typed).toBe(expected);
    }
  });
});
