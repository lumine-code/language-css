exports.consumeHyperlinkInjection = (hyperlink) => {
  const registrations = [];
  registrations.push(
    hyperlink.addInjectionPoint("source.css", {
      types: ["comment", "string_value"],
    }),
  );

  // Catch things like
  //
  // @import url(https://www.example.com/style.css);
  //
  // where the URL is unquoted.
  registrations.push(
    hyperlink.addInjectionPoint("source.css", {
      types: ["call_expression"],
      language: () => "hyperlink",
      content(node) {
        let functionName = node.descendantsOfType("function_value")[0]?.text;
        if (functionName !== "url") {
          return null;
        }

        return node.descendantsOfType("plain_value");
      },
    }),
  );
  return {
    dispose() {
      for (const registration of registrations.splice(0)) registration.dispose();
    },
  };
};

exports.consumeTodoInjection = (todo) => {
  return todo.addInjectionPoint("source.css", { types: ["comment"] });
};
