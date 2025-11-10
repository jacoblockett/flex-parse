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

const parsed = fp(data)

console.log(parsed)
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

 To learn more about what each option for the parser does, keep reading. And if you'd like to learn more about and how to use the structure that's returned, you can visit my [virty](https://github.com/jacoblockett/virty) library for details.

## Options

All options default in such a way to preserve as much about the original data as possible. You must be explicit if you want QOL results, such as ignoring empty/structural text nodes, etc.

```ts
const options = {
	ignoreEmptyText: boolean,         // false
	onText: (text: string) => string, // undefined
	trimAttributes: boolean,          // false
	trimText: boolean,                // false
	truncateAttributes: boolean,      // false
	truncateText: boolean             // false
}
```

### Table of Contents

- [ignoreEmptyText](#ignoreemptytext)
- [onText](#ontext)
- [trimAttributes](#trimattributes)
- [trimText](#trimtext)
- [truncateAttributes](#truncateattributes)
- [truncateText](#truncatetext)

### Future Plans

> 🥸 Plans change. Not all of the options listed here will be sure to exist. Their current implementation notes might differ from their eventual implementation, their name might change, etc.

- [ ] ignoreAttributes (ignores all attributes, removing them from the results)
- [ ] ignoreCommentNodes (ignores all comment nodes, removing them from the results)
- [ ] ignoreElementNodes (ignores all element nodes, removing them from the results)
- [ ] ignoreTextNodes (ignores all text nodes, removing them from the results)
- [ ] mustNotContainElementNodes (a list of case-sensitive element tag names that will throw an error if they contain any element nodes as a direct descendent)
- [ ] mustNotContainTextNodes (a list of case-sensitive element tag names that will throw an error if they contain any text nodes as a direct descendent)
- [ ] mustNotContainTextNodesStrict (a list of case-sensitive element tag names that will throw an error if they contain any text nodes as a direct or nested descendent)
- [ ] mustNotSelfClose (a list of case-sensitive element tag names that will throw an error if they self-close)
- [ ] mustPreserveWhitespace (a list of case-sensitive element tag names that, regardless of other options, will preserve their whitespace)
- [ ] mustSelfClose (a list of case-sensitive element tag names that will throw an error if they don't self-close)
- [ ] onAttribute (event fired when an attribute value is about to be pushed)
- [ ] onComment (event fired when a comment node is about to be pushed)
- [ ] onElement (event fired when an element node is about to be pushed)
- [x] <span style="text-decoration:line-through;">onText (event fired when a text node is about to be pushed)</span>
- [ ] parseChildrenAsText (a list of case-sensitive element tag names that will not have its children parsed as anything more than text. useful for script tags in html, etc.)
- [ ] parseAttributes (parses attributes into normalized js values, such as boolean attributes, numbers, dates, etc.)

---

### `ignoreEmptyText`

| Type | Default Value | Description |
| - | - | - |
| `boolean` | `false` | Ignores any empty or whitespace-only text nodes, removing them from the resulting structure. |

Example:

```js
const html = `<body>
	<div id="main"></div>
</body>`
const parsedWithEmptyText = fp(html)
const parsedWithoutEmptyText = fp(html, { ignoreEmptyText: true })

// toObject is a wrapper function that creates an object from a virty node
console.dir(toObject(parsedWithEmptyText.firstChild), { depth: null })
console.dir(toObject(parsedWithoutEmptyText.firstChild), { depth: null })
```

Output:

```sh
$ node example.js
{
  type: 'element',
  tagName: 'body',
  children: [
    { type: 'text', value: '\n\t' },
    { type: 'element', tagName: 'div', attributes: { id: 'main' } },
    { type: 'text', value: '\n' }
  ]
}
{
  type: 'element',
  tagName: 'body',
  children: [ { type: 'element', tagName: 'div', attributes: { id: 'main' } } ]
}
```

---

### `onText`

| Type | Default Value | Description |
| - | - | - |
| `function` | `undefined` | A function that fires every time a new text node has been parsed and written to the structure. Its return value will replace whatever the original text was. |

Signature:

```ts
function onText(text: string): string
```

Example:

```js
const html = "<div><span>First</span> <span>Second</span></div>"
const parsed = fp(html, {
	onText: text => {
		if (text === "Second") return "Last"

		return text
	}
})

console.log(parsed.firstChild.lastChild.text)
```

Output:

```sh
$ node example.js
Last
```

---

### `trimAttributes`

| Type | Default Value | Description |
| - | - | - |
| `boolean` | `false` | Trims leading and trailing whitespace surrounding each attribute value. |

Example:

```js
const html = `<p class=" lorem ">Lorem ipsum dolor sit amet...</p>`
const parsedWithoutTrimmedAttributes = fp(html)
const parsedWithTrimmedAttributes = fp(html, { trimAttributes: true })

console.log(`"${parsedWithoutTrimmedAttributes.firstChild.attributes.class}"`)
console.log(`"${parsedWithTrimmedAttributes.firstChild.attributes.class}"`)
```

Output:

```sh
$ node example.js
" lorem "
"lorem"
```

---

### `trimText`

| Type | Default Value | Description |
| - | - | - |
| `boolean` | `false` | Trims leading and trailing whitespace surrounding each text node. |

Example:

```js
const html = `<p>  Lorem ipsum dolor sit amet...  </p>`
const parsedWithoutTrimmedText = fp(html)
const parsedWithTrimmedText = fp(html, { trimText: true })

console.log(`"${parsedWithoutTrimmedText.firstChild.text}"`)
console.log(`"${parsedWithTrimmedText.firstChild.text}"`)
```

Output:

```sh
$ node example.js
"  Lorem ipsum dolor sit amet...  "
"Lorem ipsum dolor sit amet..."
```

> 💡 `trimText` **does not** remove text nodes whose value become `""` after trimming. If you need to remove empty or whitespace-only text nodes, use [`ignoreEmptyText`](#ignoreemptytext) instead.

---

### `truncateAttribute`

| Type | Default Value | Description |
| - | - | - |
| `boolean` | `false` | Truncates all whitespace within each attribute value into a single `U+0020` space value. |

Example:

```js
const html = `<p class="a  b    c">Lorem ipsum dolor sit amet...</p>`
const parsedWithoutTruncatedAttributes = fp(html)
const parsedWithTruncatedAttributes = fp(html, { truncateAttributes: true })

console.log(`"${parsedWithoutTruncatedAttributes.firstChild.attributes.class}"`)
console.log(`"${parsedWithTruncatedAttributes.firstChild.attributes.class}"`)
```

Output:

```sh
$ node example.js
"a  b    c"
"a b c"
```

---

### `truncateText`

| Type | Default Value | Description |
| - | - | - |
| `boolean` | `false` | Truncates all whitespace within each text node into a single `U+0020` space value. |

Example:

```js
const html = `<p>Lorem   ipsum     dolor sit amet...  </p>`
const parsedWithoutTruncatedText = fp(html)
const parsedWithTruncatedText = fp(html, { truncateText: true })

console.log(`"${parsedWithoutTruncatedText.firstChild.text}"`)
console.log(`"${parsedWithTruncatedText.firstChild.text}"`)
```

Output:

```sh
$ node example.js
"Lorem   ipsum     dolor sit amet...  "
"Lorem ipsum dolor sit amet... "
```
