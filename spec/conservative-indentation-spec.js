const path = require("node:path");

describe("language-css conservative indentation", () => {
  let editor;

  beforeEach(async () => {
    const pack = await lumine.packages.activatePackage(path.resolve(__dirname, ".."));
    for (const grammar of pack.grammars) {
      if (grammar.queryPaths?.indentsQuery) await grammar.getQuery("indentsQuery");
    }
    editor = await lumine.workspace.open();
    editor.setGrammar(lumine.grammars.grammarForScopeName("source.css"));
    editor.update({ tabLength: 2, softTabs: true });
  });

  afterEach(() => editor?.destroy());

  async function setText(source) {
    editor.setText(source);
    expect(await editor.whenGrammarSettled()).toBe(true);
  }

  async function enter(source, expected, row = 0) {
    await setText(source);
    editor.setCursorBufferPosition([row, Infinity]);
    editor.insertText("\n", { autoIndent: true, autoIndentNewline: true });
    await editor.whenGrammarSettled();
    expect(editor.lineTextForBufferRow(row + 1))
      .withContext(source)
      .toBe(" ".repeat(expected));
    expect(editor.getCursorBufferPosition().column).withContext(source).toBe(expected);
  }

  it("indents blocks without reacting to literal or comment braces", async () => {
    await enter(".card {", 2);
    await enter(".card { /* explanation */", 2);
    for (const source of [".card { color: red; }", "/* { */", '.card { content: "{"; }'])
      await enter(source, 0);
  });

  it("dedents a closing block delimiter typed after Enter", async () => {
    await enter(".card {", 2);
    editor.insertText("}", { autoIndent: true, autoDecreaseIndent: true });
    await editor.whenGrammarSettled();
    expect(editor.lineTextForBufferRow(1)).toBe("}");
  });

  it("does not guess a block after a brace in an unfinished quoted property value", async () => {
    await enter('.card { content: "{', 0);
    await enter(".card { content: 'text {", 0);
    await enter('.card[data-name="card"] {', 2);
  });

  it("preserves whitespace inside multiline literals and comments when reindenting", async () => {
    const source = ".card {\n  /* head\n        aligned\n raw */\n}";
    await setText(source);
    const before = editor.getText().split("\n");
    await editor.autoIndentBufferRows(0, editor.getLastBufferRow());
    for (const row of [2, 3]) {
      expect(editor.lineTextForBufferRow(row)).withContext(String(row)).toBe(before[row]);
    }
  });
});
