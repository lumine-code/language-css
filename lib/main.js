let urlInjection;

// A URL call may recover with arbitrary descendants under its argument list.
// Keep that content selection in JavaScript while ordinary annotations use SCM.
exports.activate = function () {
  urlInjection = lumine.grammars.addInjectionPoint("source.css", {
    type: "call_expression",
    language: () => "hyperlink",
    content(node) {
      const functionNode = node.firstNamedChild;
      if (functionNode?.type !== "function_name" || functionNode.text.toLowerCase() !== "url") {
        return null;
      }
      return node.descendantsOfType("plain_value");
    },
    languageScope: null,
  });
};

exports.deactivate = function () {
  urlInjection?.dispose();
  urlInjection = null;
};
