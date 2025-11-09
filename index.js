import { UnexpectedTokenError } from "./utils/errors.js"
import Node from "virty"
import isWhitespace from "./utils/isWhitespace.js"
import truncateWhitespace from "./utils/truncateWhitespace.js"

// TODO: Don't forget to handle CDATA, whatever the fuck that is...
// NOTE: Pi tags are the tags that start and end with <? --- ?>
// TODO: Need to profile, specifically one thing to check is if my whitespace trim/trunc method is speedier than a whitespace replace regex.
//       Not that this necessarily matters - I feel I have more control the way I'm doing it.
// TODO: If speed is wanted, I'll likely want to make the algo smarter so that trim/truncate processes aren't done post, but rather in place
//       as each character is parsed

function parseAttributeValue(value) {
	// TODO

	return value
}

/**
 * Parses the given HTML/XML data.
 *
 * @param {string|Buffer} data The HTML/XML data to parse
 * @param {object} [options]
 * @param {boolean} [options.ignoreEmptyText] Removes any empty (whitespace only) text nodes from the results
 * @param {(data: string) => string} [options.onText] An event fired when a text node is about to be pushed to the results whose return string will replace the original text node's value
 * @param {boolean} [options.trimAttribute] Trims whitespace on either side of attribute values
 * @param {boolean} [options.trimText] Trims whitespace on either side of text nodes
 * @param {boolean} [options.truncateAttribute] Collapses all multiple-sequenced whitespaces into a single whitespace on attribute values
 * @param {boolean} [options.truncateText] Collapses all multiple-sequenced whitespaces into a single whitespace on text nodes
 *
 * @returns {Node}
 */
function parse(data, options = {}) {
	if (typeof data !== "string" && !Buffer.isBuffer(data))
		throw new TypeError("Expected 'data' to be a string or Buffer")
	if (Buffer.isBuffer(data)) data = data.toString()

	data = data.trim()

	// Set default options
	if (Object.prototype.toString.call(options) !== "[object Object]") options = {}
	if (typeof options.ignoreEmptyText !== "boolean") options.ignoreEmptyText = false
	if (typeof options.onText !== "function") options.onText = undefined
	if (typeof options.trimAttribute !== "boolean") options.trimAttribute = false
	if (typeof options.trimText !== "boolean") options.trimText = false
	if (typeof options.truncateAttribute !== "boolean") options.truncateAttribute = false
	if (typeof options.truncateText !== "boolean") options.truncateText = false

	// These two functions exist solely as a breadcrumb audit for testing.
	function convertWSToText(str) {
		return str.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
	}
	function report(char) {
		console.log(
			`cnod: ${convertWSToText(`"${node.tagName}"`).padEnd(9)} |`,
			`char: ${`"${convertWSToText(char)}"`.padEnd(4, " ")} |`,
			`abuf: ${`"${convertWSToText(abuf)}"`.padEnd(5, " ")} |`,
			`cbuf: ${`"${convertWSToText(cbuf)}"`.padEnd(10, " ")} |`,
			`gate: ${(gate ? `"${convertWSToText(gate)}"` : "?").padEnd(30, " ")} |`,
			`ntype: ${(ntype ? `"${convertWSToText(ntype)}"` : "?").padEnd(9, " ")} |`,
			`ttype: ${(ttype ? `"${convertWSToText(ttype)}"` : "?").padEnd(18, " ")} |`,
			"nbuf:",
			nbuf
		)
	}

	// Character Constants
	const LT_SIGN = "<"
	const GT_SIGN = ">"
	const EQ_SIGN = "="
	const S_QUOTE = "'"
	const D_QUOTE = '"'
	const F_SLASH = "/"
	const BANG = "!"
	const DASH = "-"

	// Gates
	const TAG_NAME = "tag name"
	const ATT_NAME = "attribute name"
	const SQ_A_VAL = "single-quote attribute value"
	const DQ_A_VAL = "double-quote attribute value"
	const NQ_A_VAL = "no-quote attribute value"

	// Node Types
	const COMMENT = "comment"
	const ELEMENT = "element"
	const TEXT = "text"

	// Tag Types
	const CL_TAG = "closing tag"
	const SC_TAG = "self-closing tag"

	// Loop Dependents
	const root = new Node({ type: ELEMENT, tagName: "ROOT" })
	let node = root
	let nbuf = {} // node buffer
	let abuf = "" // attribute name buffer
	let cbuf = "" // character buffer
	let gate // filter gates dictating where the cbuf is meant to be flushed
	let ntype // node type that is currently open
	let ttype // tag type for the currently open tag declaration

	for (let i = 0; i < data.length; i++) {
		const char = data[i]

		// report(char)

		if (char === LT_SIGN) {
			if (ttype === SC_TAG) throw new UnexpectedTokenError(char, i + 1)
			if (ntype === ELEMENT && gate !== SQ_A_VAL && gate !== DQ_A_VAL) throw new UnexpectedTokenError(char, i + 1)

			if (!ntype) {
				ntype = ELEMENT
				gate = TAG_NAME
				continue
			} else if (ntype === TEXT) {
				ntype = ELEMENT
				gate = TAG_NAME

				if (options.onText) {
					cbuf = options.onText(cbuf)

					if (typeof cbuf !== "string") throw new Error("Expected the result of 'onText' to be a string")
				}
				if (options.trimText) cbuf = cbuf.trim()
				if (options.truncateText) cbuf = truncateWhitespace(cbuf)
				if (options.ignoreEmptyText && !cbuf.trim().length) {
					cbuf = ""
					continue
				}

				node.appendChild(new Node({ type: TEXT, value: cbuf }))
				cbuf = ""
				continue
			}
		} else if (char === GT_SIGN) {
			if (ntype === ELEMENT) {
				if (gate !== SQ_A_VAL && gate !== DQ_A_VAL) {
					if (gate === TAG_NAME) {
						nbuf.tagName = cbuf
					} else if (gate === ATT_NAME) {
						if (!nbuf.attributes) nbuf.attributes = {}
						if (options.onAttribute) {
							const attr = options.onAttribute(cbuf, "", { tagName: nbuf.tagName, attributes: { ...nbuf.attributes } })

							if (
								Array.isArray(attr) &&
								typeof attr[0] === "string" &&
								attr[0].length &&
								(typeof attr[1] === "string" || typeof attr[1] === "number" || typeof attr[1] === "boolean")
							) {
								if (typeof attr[1] === "string") {
									if (options.trimAttribute) attr[1] = attr[1].trim()
									if (options.truncateAttribute) attr[1] = truncateWhitespace(attr[1])
								}

								nbuf.attributes[attr[0]] = attr[1]
								// TO FUTURE JACOB: Trying desperately to figure out the best way to implement the event functions.
								// Seems like providing contextual information would be the best way to go, but to what end? Should
								// I provide the working nodes, buffer node, and all buffers? How do I present that, or whatever I
								// end up providing? That kind of thing.
							}
						} else {
							nbuf.attributes[cbuf] = ""
						}
					} else if (gate === NQ_A_VAL) {
						if (!nbuf.attributes) nbuf.attributes = {}
						if (options.trimAttribute) cbuf = cbuf.trim()
						if (options.truncateAttribute) cbuf = truncateWhitespace(cbuf)

						nbuf.attributes[abuf] = cbuf
						abuf = ""
					} else if (!gate && abuf) {
						if (!nbuf.attributes) nbuf.attributes = {}

						nbuf.attributes[abuf] = ""
						abuf = ""
					}

					if (ttype === CL_TAG) {
						if (node === root) throw new Error("Unmatched closing tag")
						if (node.tagName !== nbuf.tagName && node.parent.tagName !== nbuf.tagName)
							throw new Error("Unmatched closing tag")

						node = node.parent
					} else {
						const nnode = new Node({ type: ELEMENT, tagName: nbuf.tagName, attributes: nbuf.attributes })

						node.appendChild(nnode)

						if (ttype !== SC_TAG) node = nnode
					}

					cbuf = ""
					nbuf = {}
					gate = undefined
					ntype = undefined
					ttype = undefined
					continue
				}
			} else if (ntype === COMMENT) {
				if (cbuf[cbuf.length - 2] === DASH && cbuf[cbuf.length - 1] === DASH) {
					node.appendChild(new Node({ type: COMMENT, value: `${cbuf}${char}` }))
					cbuf = ""
					ntype = undefined

					continue
				}
			}
		} else if (isWhitespace(char)) {
			if (ntype === ELEMENT) {
				if (!gate) continue

				if (gate !== SQ_A_VAL && gate !== DQ_A_VAL) {
					if (cbuf) {
						if (gate === TAG_NAME) {
							nbuf.tagName = cbuf
							cbuf = ""
							gate = undefined
							continue
						} else if (gate === ATT_NAME) {
							abuf = cbuf
							cbuf = ""
							gate = undefined
							continue
						} else if (gate === NQ_A_VAL) {
							if (!nbuf.attributes) nbuf.attributes = {}
							if (options.trimAttribute) cbuf = cbuf.trim()
							if (options.truncateAttribute) cbuf = truncateWhitespace(cbuf)

							nbuf.attributes[abuf] = cbuf
							abuf = ""
							cbuf = ""
							gate = undefined
							continue
						}
					}

					continue
				}
			}
		} else if (char === F_SLASH) {
			if (ttype === SC_TAG) throw new UnexpectedTokenError(char, i + 1)

			if (ntype === ELEMENT) {
				if (gate === TAG_NAME) {
					if (cbuf) {
						ttype = SC_TAG
						nbuf.tagName = cbuf
						cbuf = ""
						gate = undefined
						continue
					} else {
						ttype = CL_TAG
						continue
					}
				} else if (gate === NQ_A_VAL) {
					ttype = SC_TAG

					if (!nbuf.attributes) nbuf.attributes = {}
					if (options.trimAttribute) cbuf = cbuf.trim()
					if (options.truncateAttribute) cbuf = truncateWhitespace(cbuf)

					nbuf.attributes[abuf] = cbuf
					abuf = ""
					cbuf = ""
					gate = undefined
					continue
				} else if (!gate) {
					ttype = SC_TAG
					continue
				}
			}
		} else if (char === EQ_SIGN) {
			if (gate === ATT_NAME) {
				abuf = cbuf
				cbuf = EQ_SIGN
				gate = undefined
				continue
			}
		} else if ((char === S_QUOTE && gate === SQ_A_VAL) || (char === D_QUOTE && gate === DQ_A_VAL)) {
			if (!nbuf.attributes) nbuf.attributes = {}
			if (options.trimAttribute) cbuf = cbuf.trim()
			if (options.truncateAttribute) cbuf = truncateWhitespace(cbuf)

			nbuf.attributes[abuf] = cbuf
			abuf = ""
			cbuf = ""
			gate = undefined
			continue
		} else if (ntype === ELEMENT) {
			if (gate === TAG_NAME) {
				if (cbuf[0] === BANG && cbuf[1] === DASH && char === DASH) {
					cbuf = "<!--"
					gate = undefined
					ntype = COMMENT
					continue
				}
			} else if (!gate) {
				if (abuf) {
					if (cbuf === EQ_SIGN) {
						if (char === S_QUOTE || char === D_QUOTE) {
							cbuf = ""

							if (char === S_QUOTE) {
								gate = SQ_A_VAL
							} else if (char === D_QUOTE) {
								gate = DQ_A_VAL
							}

							continue
						} else {
							cbuf = char
							gate = NQ_A_VAL
							continue
						}
					} else if (!cbuf) {
						if (!nbuf.attributes) nbuf.attributes = {}

						nbuf.attributes[abuf] = ""
						abuf = ""
						gate = ATT_NAME
					}
				} else if (nbuf.tagName) {
					gate = ATT_NAME
				}
			}
		}

		if (!ntype) ntype = TEXT

		cbuf = `${cbuf}${char}`
	}

	if (cbuf) {
		if (ntype === TEXT) {
			if (options.onText) {
				cbuf = options.onText(cbuf)

				if (typeof cbuf !== "string") throw new Error("Expected the result of 'onText' to be a string")
			}
			if (options.trimText) cbuf = cbuf.trim()
			if (options.truncateText) cbuf = truncateWhitespace(cbuf)
			if (options.ignoreEmptyText && !cbuf.length) return root

			node.appendChild(new Node({ type: TEXT, value: cbuf }))
		} else {
			throw new Error("Unexpected end of input")
		}
	}

	return root
}

export default parse
