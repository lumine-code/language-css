; Existing literal and comment contents are user data, including whitespace.
([(string_value) (comment)] @preserve
  (#is? indent.reindent true)
  (#is-not? indent.matchesCurrentRow startPosition)
  (#set! indent.force true))

; Recovery can misread a quoted "{" as a block and swallow the real closer
; into string_content. Trust recovered braces only at an unfinished header.
("{" @indent
  (#is-not? test.descendantOfType ERROR))
((ERROR "{" @indent) @_error
  (#is? test.lastTextOnRow true)
  (#not-match? @_error "(?:^|[;{\\r\\n])[ \\t]*[-\\w]+[ \\t]*:[ \\t]*(?:\"(?:\\\\.|[^\"\\\\\\r\\n])*|'(?:\\\\.|[^'\\\\\\r\\n])*|[uU][rR][lL]\\([^\\)\\r\\n]*)\\{$"))
(ERROR "{" . (comment) @indent
  (#is? test.lastTextOnRow true))

"}" @dedent
