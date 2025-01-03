# Flex-Parse

> ⚠️ This library is in its early stages of development. Expect bugs, and expect them to be plentiful. Until a v1.0.0 release, this message will persist.

Flex-parse is a document parser that tries to abide by the following rules:

1. Regardless of syntactic rules, if it can be understood, it will be parsed
2. Preserve everything unless otherwise noted by the user through options

It returns a document structure utilizing [virty](https://github.com/jacoblockett/virty), allowing you to query and manipulate the results.

### A Note on Performance

While it would like to be, Flex-parse doesn't strive to be the fastest parser out there. As I near v1.0.0, I'll try to get some benchmarking done, but if you're looking for performance over anything else, this is not the library for you.

## Installation

The release on Github prior to v1.0.0 will likely be the best place to install from. Development may be sporadic and/or rapid at times, and I won't always be pushing the latest updates to NPM.

```bash
# Latest release
pnpm i "https://github.com/jacoblockett/flex-parse"
```

```bash
# Release hosted on NPM
pnpm i flex-parse
```

## Usage

### Signature:

```ts
function parse(
	data: string | Buffer,
	options?: {
		ignoreEmptyTextNode?: boolean
		trimTextNode?: boolean
		truncateTextNode?: boolean
		trimAttribute?: boolean
		truncateAttribute?: boolean
	}
): Node
```

### Basic:

```js
import fp from "flex-parse"

const data = `<body>
    <h1>Hello, world!</h1>
    <h2>Sub-header</h2>
    <div id="some-id" bool-attr>
        <!-- todo -->
    </div>
</body>`

const results = fp(data)

console.log(results)
```

Using this basic example, you'll receive a structure that, when unmasked, looks something like this:

```json
{
	"type": "element",
	"tagName": "ROOT",
	"children": [
		{
			"type": "element",
			"tagName": "body",
			"children": [
				{ "type": "text", "value": "\n    " },
				{
					"type": "element",
					"tagName": "h1",
					"children": [{ "type": "text", "value": "Hello, world!" }]
				},
				{ "type": "text", "value": "\n    " },
				{
					"type": "element",
					"tagName": "h2",
					"children": [{ "type": "text", "value": "Sub-header" }]
				},
				{ "type": "text", "value": "\n    " },
				{
					"type": "element",
					"tagName": "div",
					"attributes": { "id": "some-id", "bool-attr": "" },
					"children": [
						{ "type": "text", "value": "\n        " },
						{ "type": "comment", "value": "<!-- todo -->" },
						{ "type": "text", "value": "\n    " }
					]
				},
				{ "type": "text", "value": "\n" }
			]
		}
	]
}
```

> 💡 Flex-parse will always wrap the provided data in a `"ROOT"` element.

Now, this result to some will understandbly be confusing or overwhelming. After all, why are there so many text nodes all over the place when the data only has two visible text nodes, `"Hello, world!"` and `"Sub-header"`? The answer is that a text node is not simply any visible text that's understood by a human as _text_. It is instead any portion of the data that is not an element node and not a comment node. **This will include any whitespace used for formatting.** As mentioned in the rules of this library, the parser will be as greedy as possible. It doesn't want to make any assumptions about your data.

So, your next big question is probably, "_How do I get rid of those text nodes used for formatting?_" Luckily, this is a super simple thing to do with the `ignoreEmptyTextNode` option. In the basic example above, replace the current parse command with:

```js
const results = fp(data, { ignoreEmptyTextNode: true })
```

With that one simple change, you've simplified your results into:

```json
{
	"type": "element",
	"tagName": "ROOT",
	"children": [
		{
			"type": "element",
			"tagName": "body",
			"children": [
				{
					"type": "element",
					"tagName": "h1",
					"children": [{ "type": "text", "value": "Hello, world!" }]
				},
				{
					"type": "element",
					"tagName": "h2",
					"children": [{ "type": "text", "value": "Sub-header" }]
				},
				{
					"type": "element",
					"tagName": "div",
					"attributes": { "id": "some-id", "bool-attr": "" },
					"children": [{ "type": "comment", "value": "<!-- todo -->" }]
				}
			]
		}
	]
}
```

And that's all there is to it! To learn more about what each option for the parser does, keep reading. And if you'd like to learn more about and how to use the structure that's returned, you can visit my [virty](https://github.com/jacoblockett/virty) library for details.

## Options

All options are defaulted to `false`, meaning that if you don't explicitly ask for it, it won't be used by the parser.

### Currently Implemented

- [ignoreEmptyTextNode](#ignoreemptytextnode)
- [trimAttributeValue](#trimattributevalue)
- [trimTextNode](#trimtextnode)
- [truncateAttributeValue](#truncateattributevalue)
- [truncateTextNode](#truncatetextnode)

### Planned

_Note_: Plans change. Not all of the options listed here will be sure to exist. Their current implementation notes might differ from their eventual implementation. Their name might change. Etc.

- ignoreAttributes (ignores all attributes, removing them from the results)
- ignoreCommentNodes (ignores all comment nodes, removing them from the results)
- ignoreElementNodes (ignores all element nodes, removing them from the results)
- ignoreTextNodes (ignores all text nodes, removing them from the results)
- mustNotContainElementNodes (a list of case-sensitive element tag names that will throw an error if they contain any element nodes as a direct descendent)
- mustNotContainTextNodes (a list of case-sensitive element tag names that will throw an error if they contain any text nodes as a direct descendent)
- mustNotContainTextNodesStrict (a list of case-sensitive element tag names that will throw an error if they contain any text nodes as a direct or nested descendent)
- mustNotSelfClose (a list of case-sensitive element tag names that will throw an error if they self-close)
- mustPreserveWhitespace (a list of case-sensitive element tag names that, regardless of other options, will preserve their whitespace)
- mustSelfClose (a list of case-sensitive element tag names that will throw an error if they don't self-close)
- onAttribute (event fired when an attribute value is about to be pushed)
- onComment (event fired when a comment node is about to be pushed)
- onElement (event fired when an element node is about to be pushed)
- onText (event fired when a text node is about to be pushed)
- parseChildrenAsText (a list of case-sensitive element tag names that will not have its children parsed as anything more than text. useful for script tags in html, etc.)
- parseAttributes (parses attributes into normalized js values, such as boolean attributes, numbers, dates, etc.)

---

### `ignoreEmptyTextNode`

Ignores any empty or whitespace-only text nodes, removing them from the resulting structure.

Example data:

```html
<body>
	<div id="main"></div>
</body>
```

Default:

```json
{
	"type": "element",
	"tagName": "ROOT",
	"children": [
		{
			"type": "element",
			"tagName": "body",
			"children": [
				// Notice the additional text nodes representing structural formatting
				{ "type": "text", "value": "\r\n\t" },
				{ "type": "element", "tagName": "div", "attributes": { "id": "main" } },
				{ "type": "text", "value": "\r\n" }
			]
		}
	]
}
```

With the option set to `true`:

```json
{
	"type": "element",
	"tagName": "ROOT",
	"children": [
		{
			"type": "element",
			"tagName": "body",
			// The structural formatting text nodes have been removed
			"children": [{ "type": "element", "tagName": "div", "attributes": { "id": "main" } }]
		}
	]
}
```

---

### `trimAttributeValue`

Trims leading and trailing whitespace surrounding each attribute value.

Example data:

```html
<p class=" lorem ">Lorem ipsum dolor sit amet...</p>
```

Default:

```json
{
	"type": "element",
	"tagName": "ROOT",
	"children": [
		{
			"type": "element",
			"tagName": "p",
			// Notice the surrounding whitespace was retained on the class attribute
			"attributes": { "class": " lorem " },
			"children": [{ "type": "text", "value": "Lorem ipsum dolor sit amet..." }]
		}
	]
}
```

With the option set to `true`:

```json
{
	"type": "element",
	"tagName": "ROOT",
	"children": [
		{
			"type": "element",
			"tagName": "p",
			//The surrounding whitespace is now removed
			"attributes": { "class": "lorem" },
			"children": [{ "type": "text", "value": "Lorem ipsum dolor sit amet..." }]
		}
	]
}
```

---

### `trimTextNode`

Trims leading and trailing whitespace surrounding each text node.

Example data:

```html
<p>Lorem ipsum dolor sit amet...</p>
```

Default:

```json
{
	"type": "element",
	"tagName": "ROOT",
	"children": [
		{
			"type": "element",
			"tagName": "p",
			"children": [
				{
					"type": "text",
					// Notice the surrounding whitespace was retained around the text value
					"value": "  Lorem ipsum dolor sit amet...  "
				}
			]
		}
	]
}
```

With the option set to `true`:

```json
{
	"type": "element",
	"tagName": "ROOT",
	"children": [
		{
			"type": "element",
			"tagName": "p",
			"children": [
				{
					"type": "text",
					// The surrounding whitespace has been removed
					"value": "Lorem ipsum dolor sit amet..."
				}
			]
		}
	]
}
```

> ❗ A common point of confusion is that `trimTextNode` will trim leading and trailing whitespace around elements. This is not correct. Trim will simply trim the text node's string value. If the resulting text node is an empty string, it **will not remove the text node**. To remove empty text nodes in this manner, use the [`ignoreEmptyTextNode`](#ignoreemptytextnode) option instead. Additionally, you _do not_ need to use `trimTextNode` in conjunction with `ignoreEmptyTextNode` if your desire is to remove any text nodes with whitespace only. The parser will handle that logic for you.

---

### `truncateAttributeValue`

Truncates all whitespace within the attribute value into a single `U+0020` space value.

Example data:

```html
<p class="a  b    c">Lorem ipsum dolor sit amet...</p>
```

Default:

```json
{
	"type": "element",
	"tagName": "ROOT",
	"children": [
		{
			"type": "element",
			"tagName": "p",
			// Notice the class attribute retains the spacing between a, b, and c
			"attributes": { "class": "a  b    c" },
			"children": [{ "type": "text", "value": "Lorem ipsum dolor sit amet..." }]
		}
	]
}
```

With the option set to `true`:

```json
{
	"type": "element",
	"tagName": "ROOT",
	"children": [
		{
			"type": "element",
			"tagName": "p",
			// The spacing between a, b, and c has been normalized
			"attributes": { "class": "a b c" },
			"children": [{ "type": "text", "value": "Lorem ipsum dolor sit amet..." }]
		}
	]
}
```

---

### `truncateTextNode`

Truncates all whitespace within each text node into a single `U+0020` space value.

Example data:

```html
<p>Lorem ipsum dolor sit amet...</p>
```

Default:

```json
{
	"type": "element",
	"tagName": "ROOT",
	"children": [
		{
			"type": "element",
			"tagName": "p",
			"children": [
				{
					"type": "text",
					// Notice the text node value retains the original spacing
					"value": "Lorem   ipsum     dolor sit amet...  "
				}
			]
		}
	]
}
```

With the option set to `true`:

```json
{
	"type": "element",
	"tagName": "ROOT",
	"children": [
		{
			"type": "element",
			"tagName": "p",
			"children": [
				{
					"type": "text",
					// The spacing between the words has been normalized
					"value": "Lorem ipsum dolor sit amet... "
				}
			]
		}
	]
}
```
