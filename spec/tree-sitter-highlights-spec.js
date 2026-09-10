const fs = require("fs");
const path = require("path");
const { Point } = require("lumine");

const HIGHLIGHTS_PATH = path.join(__dirname, "..", "grammars", "css-highlights.scm");

describe("CSS Tree-sitter highlights", () => {
  let editor;
  let languageMode;

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-css");
  });

  afterEach(() => editor?.destroy());

  async function setUp(text) {
    editor = await lumine.workspace.open("highlights.css");
    editor.setText(text);
    languageMode = editor.getBuffer().languageMode;
    await languageMode.ready;
  }

  function indexOfOccurrence(needle, occurrence = 0) {
    const text = editor.getText();
    let index = -1;
    for (let count = 0; count <= occurrence; count++) {
      index = text.indexOf(needle, index + 1);
    }
    expect(index).not.toBe(-1);
    return index;
  }

  function scopesIn(needle, offset = 0, occurrence = 0) {
    const index = indexOfOccurrence(needle, occurrence) + offset;
    const point = editor.getBuffer().positionForCharacterIndex(index);
    return editor.scopeDescriptorForBufferPosition(point).getScopesArray();
  }

  function rawCaptures(startRow, endRow) {
    const layer = languageMode.rootLanguageLayer;
    const options =
      startRow == null
        ? undefined
        : {
            startPosition: new Point(startRow, 0),
            endPosition: new Point(endRow, 0),
          };
    return layer.queries.highlightsQuery.captures(layer.tree.rootNode, options);
  }

  it("preserves selector, function, argument, variable, URL, and recovery scopes", async () => {
    await setUp(
      [
        "article::after {",
        "  --accent: #abc;",
        "  color: var(--accent, red);",
        "  display: block;",
        "  background: url(assets/image.png);",
        "  transform: translate(calc(100% - 1px), 0);",
        '  content: "value";',
        "}",
        "a { color: red !i }",
      ].join("\r\n"),
    );

    expect(scopesIn("article")).toContain("entity.name.tag.css");
    expect(scopesIn("after")).toContain("entity.other.attribute-name.pseudo-element.css");
    expect(scopesIn("after")).not.toContain("entity.name.tag.css");
    expect(scopesIn("--accent", 0, 0)).toContain("variable.other.assignment.css");
    expect(scopesIn("var")).toContain("support.function.var.css");
    expect(scopesIn("--accent", 0, 1)).toContain("variable.css");
    expect(scopesIn("red", 0, 0)).toContain("variable.css");
    expect(scopesIn("block")).not.toContain("variable.css");
    expect(scopesIn("assets/image.png")).toContain("string.unquoted.css");
    expect(scopesIn("url(", 3)).toContain(
      "punctuation.definition.arguments.begin.bracket.round.css",
    );
    expect(scopesIn("assets/image.png)", "assets/image.png".length)).toContain(
      "punctuation.definition.arguments.end.bracket.round.css",
    );
    expect(scopesIn('"value"')).toContain("punctuation.definition.string.begin.css");
    expect(scopesIn('"value"', '"value"'.length - 1)).toContain(
      "punctuation.definition.string.end.css",
    );
    expect(scopesIn("!i")).toContain("meta.property-value.css");
  });

  it("returns local argument and value captures when calls start before the viewport", async () => {
    await setUp(
      [
        "a {",
        "  color: var(",
        "    --accent,",
        "    red",
        "  );",
        "  background: url(",
        "    assets/image.png",
        "  );",
        "}",
      ].join("\n"),
    );

    const variableCaptures = rawCaptures(2, 5).filter((capture) =>
      [
        "variable.css",
        "punctuation.definition.arguments.begin.bracket.round.css",
        "punctuation.definition.arguments.end.bracket.round.css",
      ].includes(capture.name),
    );
    expect(
      variableCaptures.every(
        (capture) => capture.node.startPosition.row >= 2 && capture.node.startPosition.row < 5,
      ),
    ).toBe(true);
    expect(variableCaptures.filter((capture) => capture.name === "variable.css").length).toBe(2);
    expect(
      variableCaptures.some(
        (capture) =>
          capture.name === "punctuation.definition.arguments.end.bracket.round.css" &&
          capture.node.startPosition.row === 4,
      ),
    ).toBe(true);

    const urlCaptures = rawCaptures(6, 8).filter((capture) =>
      [
        "string.unquoted.css",
        "punctuation.definition.arguments.begin.bracket.round.css",
        "punctuation.definition.arguments.end.bracket.round.css",
      ].includes(capture.name),
    );
    expect(
      urlCaptures.every(
        (capture) => capture.node.startPosition.row >= 6 && capture.node.startPosition.row < 8,
      ),
    ).toBe(true);
    expect(
      urlCaptures.some(
        (capture) => capture.name === "string.unquoted.css" && capture.node.startPosition.row === 6,
      ),
    ).toBe(true);
    expect(
      urlCaptures.some(
        (capture) =>
          capture.name === "punctuation.definition.arguments.end.bracket.round.css" &&
          capture.node.startPosition.row === 7,
      ),
    ).toBe(true);
  });

  it("keeps tile captures bounded and local inside a large arguments parent", async () => {
    const lines = ["a {", "  color: var("];
    for (let index = 0; index < 6000; index++) lines.push(`    value${index},`);
    lines.push("    fallback", "  );", "}");
    await setUp(lines.join("\r\n"));

    const captures = rawCaptures(3000, 3006);
    const localCaptures = captures.filter((capture) => capture.node.startPosition.row >= 3000);
    expect(captures.length).toBeLessThanOrEqual(24);
    expect(localCaptures.length).toBe(18);
    expect(localCaptures.every((capture) => capture.node.startPosition.row < 3006)).toBe(true);
  });

  it("keeps rule-set block punctuation leaf-rooted inside a large block", async () => {
    const lines = [".selector {"];
    for (let index = 0; index < 6000; index++) lines.push(`  --property-${index}: ${index};`);
    lines.push("}");
    await setUp(lines.join("\r\n"));

    expect(
      editor.scopeDescriptorForBufferPosition([0, lines[0].indexOf("{")]).getScopesArray(),
    ).toContain("punctuation.section.property-list.begin.bracket.curly.css");
    expect(editor.scopeDescriptorForBufferPosition([6001, 0]).getScopesArray()).toContain(
      "punctuation.section.property-list.end.bracket.curly.css",
    );

    const captures = rawCaptures(3000, 3006);
    const localCaptures = captures.filter((capture) => capture.node.startPosition.row >= 3000);
    expect(captures.length).toBeLessThanOrEqual(80);
    expect(localCaptures.length).toBeGreaterThan(0);
    expect(localCaptures.every((capture) => capture.node.startPosition.row < 3006)).toBe(true);

    const query = fs.readFileSync(HIGHLIGHTS_PATH, "utf8");
    expect(query).toContain('(#is? test.typeAt "parent.parent rule_set")');
    expect(query).not.toMatch(/\(rule_set\s+\(block\s+"[{}]"/);
  });

  it("keeps unbounded contexts leaf-rooted and the bounded pseudo-element structural", () => {
    const query = fs.readFileSync(HIGHLIGHTS_PATH, "utf8").replaceAll("\r\n", "\n");

    expect(query).toContain('(#is? test.childOfType "block")');
    expect(query).toContain('(#is? test.childOfType "stylesheet")');
    expect(query).toContain('(#is? test.typeAt "parent arguments")');
    expect(query).toContain('(#is? test.typeAt "previousNamedSibling declaration")');
    expect(query).toContain('(pseudo_element_selector\n  "::"\n  (tag_name) @_IGNORE_');
    expect(query.match(/test\.descendantOfNodeWithData/g).length).toBe(2);
  });
});
