import parse from "../src/index.js"
import { z } from "zod"
import { describe, it } from "node:test"
import assert from "node:assert"

const COMMENT = "comment"
const ELEMENT = "element"
const TEXT = "text"

const ROOT_SCHEMA = z.object({
	tagName: z.literal("ROOT"),
	type: z.literal(ELEMENT)
})

const tests = [
	// Basic
	{
		data: `text`,
		schema: ROOT_SCHEMA.extend({
			children: z.tuple([
				z.object({
					type: z.literal(TEXT),
					value: z.literal(`text`)
				})
			])
		})
	},
	{
		data: `<!-- comment -->`,
		schema: ROOT_SCHEMA.extend({
			children: z.tuple([
				z.object({
					type: z.literal(COMMENT),
					value: z.literal(`<!-- comment -->`)
				})
			])
		})
	},
	{
		data: `<div></div>`,
		schema: ROOT_SCHEMA.extend({
			children: z.tuple([
				z.object({
					children: z.array().length(0),
					tagName: z.literal(`div`),
					type: z.literal(ELEMENT)
				})
			])
		})
	},
	// Basic element tests with whitespace varation
	{
		// prettier-ignore
		data: [
			// Single opening tag with no closing tag, variant whitespace
			`<div>`, `< div>`, `<div >`, `< div >`, `<  div>`, `<div  >`, `<  div  >`, `< div  >`, `<  div >`,
			// Self-closing tag, variant whitespace
			`<div/>`, `< div/>`, `<div />`, `<div/ >`, `< div />`, `< div/ >`, `< div / >`, `<div / >`,
			// Opening and closing tag, variant whitespace, no children
			`<div></div>`, `<div>< /div>`, `<div></ div>`, `<div></div >`, `<div>< / div>`, `<div></ div >`, `<div>< /div >`, `<div>< / div >`,
		],
		schema: ROOT_SCHEMA.extend({
			children: z.tuple([
				z.object({
					children: z.array().length(0),
					tagName: z.literal(`div`),
					type: z.literal(ELEMENT)
				})
			])
		})
	},
	// Basic element test with single text child
	{
		data: `<div>test</div>`,
		schema: ROOT_SCHEMA.extend({
			children: z.tuple([
				z.object({
					children: z.tuple([
						z.object({
							type: z.literal(TEXT),
							value: z.literal("test")
						})
					]),
					tagName: z.literal(`div`),
					type: z.literal(ELEMENT)
				})
			])
		})
	},
	// Basic element test with single comment child
	{
		data: `<div><!-- test comment --></div>`,
		schema: ROOT_SCHEMA.extend({
			children: z.tuple([
				z.object({
					children: z.tuple([
						z.object({
							type: z.literal(COMMENT),
							value: z.literal("<!-- test comment -->")
						})
					]),
					tagName: z.literal(`div`),
					type: z.literal(ELEMENT)
				})
			])
		})
	},
	// Basic element test with single element child
	{
		data: `<div><h1>test</h1></div>`,
		schema: ROOT_SCHEMA.extend({
			children: z.tuple([
				z.object({
					children: z.tuple([
						z.object({
							children: z.tuple([
								z.object({
									type: z.literal(TEXT),
									value: z.literal("test")
								})
							]),
							tagName: z.literal("h1"),
							type: z.literal(ELEMENT)
						})
					]),
					tagName: z.literal(`div`),
					type: z.literal(ELEMENT)
				})
			])
		})
	},
	// Complex element test with multiple nested children, attributes
	{
		data: `<div><h1>test</h1>random text<img src="self-closing"/><!--I'm a comment --><div id="a" b><h2>Hey</h2></div></div>`,
		schema: ROOT_SCHEMA.extend({
			children: z.tuple([
				z.object({
					children: z.tuple([
						z.object({
							children: z.tuple([
								z.object({
									type: z.literal(TEXT),
									value: z.literal(`test`)
								})
							]),
							tagName: z.literal(`h1`),
							type: z.literal(ELEMENT)
						}),
						z.object({
							type: z.literal(TEXT),
							value: z.literal(`random text`)
						}),
						z.object({
							attributes: z.object({ src: z.literal(`self-closing`) }),
							tagName: z.literal(`img`),
							type: z.literal(ELEMENT)
						}),
						z.object({
							type: z.literal(COMMENT),
							value: z.literal(`<!--I'm a comment -->`)
						}),
						z.object({
							attributes: z.object({ id: z.literal(`a`), b: z.literal(``) }),
							children: z.tuple([
								z.object({
									children: z.tuple([
										z.object({
											type: z.literal(TEXT),
											value: z.literal(`Hey`)
										})
									]),
									tagName: z.literal(`h2`),
									type: z.literal(ELEMENT)
								})
							]),
							tagName: z.literal(`div`),
							type: z.literal(ELEMENT)
						})
					]),
					tagName: z.literal(`div`),
					type: z.literal(ELEMENT)
				})
			])
		})
	},
	// Complex multi-line element test
	{
		data: `<body>
	<div id="main">Never</div>
</body>`,
		schema: ROOT_SCHEMA.extend({
			children: z.tuple([
				z.object({
					children: z.tuple([
						z.object({
							type: z.literal(TEXT),
							value: z.literal("\n\t")
						}),
						z.object({
							attributes: z.object({ id: z.literal("main") }),
							children: z.tuple([
								z.object({
									type: z.literal(TEXT),
									value: z.literal("Never")
								})
							]),
							tagName: z.literal("div"),
							type: z.literal(ELEMENT)
						}),
						z.object({
							type: z.literal(TEXT),
							value: z.literal("\n")
						})
					]),
					tagName: z.literal("body"),
					type: z.literal(ELEMENT)
				})
			])
		})
	}
]

describe("parse", () => {
	for (const test of tests) {
		it(`testing ${
			Array.isArray(test.data) ? `[ ${test.data.map(data => `"${data}"`).join(", ")}]` : `"${test.data}"`
		}`, () => {
			if (test.expectedToThrow) {
				assert.throws(() => parse(test.data))
			} else if (Array.isArray(test.data)) {
				const parsed = test.data.map(parse)

				for (const node of parsed) {
					const { success, error } = test.schema.safeParse(node)

					assert.strictEqual(success, true, error)
				}
			} else {
				const parsed = parse(test.data)
				const { success, error } = test.schema.safeParse(parsed)

				assert.strictEqual(success, true, error)
			}
		})
	}
})
