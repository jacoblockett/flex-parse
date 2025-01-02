import { UnexpectedTokenError } from "./utils/errors.js"
import Node from "../tags/index.js"
import isWhitespace from "./utils/isWhitespace.js"
import truncateWhitespace from "./utils/truncateWhitespace.js"

// TODO: Don't forget to handle CDATA, whatever the fuck that is...
// NOTE: Pi tags are the tags that start and end with <? --- ?>

/**
 * Options to implement:
 * events:
 * onTagOpened
 * onTagClosed
 * onComment
 * customization:
 * ignorePI (true/false)
 * truncateAttribute
 * truncateText
 * trimAttribute
 * trimText
 * mode (html/xml = default)
 */

// NOTE: If the root level has multiple tags (PI, declarations, etc.), make sure to wrap them in a root Tag
// TODO: Probably a good idea to think of how to automatically detect the type of data, i.e. XML vs HTML
// NOTE: The parser should make absolutely no assumptions about the provided data and should parse it according to
//       xml spec. Options should be provided to extensively customize how the parser works. A premade "HTML"
//       exported options object would be ideal, I'm sure, too.
// TODO: Need to profile, specifically one thing to check is if my whitespace trim/trunc method is speedier than a whitespace replace regex
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
 * @param {boolean} [options.ignoreEmptyTextNode] Removes any empty (whitespace only) text nodes from the results
 * @param {boolean} [options.trimAttribute] Trims whitespace on either side of attribute values
 * @param {boolean} [options.trimTextNode] Trims whitespace on either side of text nodes
 * @param {boolean} [options.truncateAttribute] Collapses all multiple-sequenced whitespaces into a single whitespace on attribute values
 * @param {boolean} [options.truncateTextNode] Collapses all multiple-sequenced whitespaces into a single whitespace on text nodes
 *
 * @returns {Node}
 */
function parse(data, options = {}) {
	if (typeof data !== "string" && !Buffer.isBuffer(data))
		throw new TypeError("Expected 'data' to be a string or Buffer")
	if (Buffer.isBuffer(data)) data = data.toString()

	// Set default options
	if (Object.prototype.toString.call(options) !== "[object Object]") options = {}
	if (typeof options.ignoreEmptyTextNode !== "boolean") options.ignoreEmptyTextNode = false // i.e. <div> <img /></div> would normally give a text node between the opening div tag and the img tag. If this option is true, that text node would be ignored and not pushed to the final results.
	if (typeof options.trimTextNode !== "boolean") options.trimTextNode = false // i.e. " test " -> "test"
	if (typeof options.truncateTextNode !== "boolean") options.truncateTextNode = false // i.e. "  a  b  c  " -> " a b c "

	// testing only. remove this later
	function report(char) {
		console.log(
			`cnod: ${`"${node.tagName}"`.padEnd(8)} |`,
			`char: "${char}" |`,
			`abuf: ${`"${abuf}"`.padEnd(5, " ")} |`,
			`cbuf: ${`"${cbuf}"`.padEnd(30, " ")} |`,
			`gate: ${(gate ? `"${gate}"` : "?").padEnd(35, " ")} |`,
			`ntype: ${(ntype ? `"${ntype}"` : "?").padEnd(10, " ")} |`,
			`ttype: ${(ttype ? `"${ttype}"` : "?").padEnd(18, " ")} |`,
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
				if ((options.ignoreEmptyTextNode && cbuf.trim().length) || !options.ignoreEmptyTextNode) {
					if (options.trimTextNode) cbuf = cbuf.trim()
					if (options.truncateTextNode) cbuf = truncateWhitespace(cbuf)

					node.appendChild(new Node({ type: TEXT, value: cbuf }))
				}
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

						nbuf.attributes[cbuf] = ""
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
			if ((options.ignoreEmptyTextNode && cbuf.trim().length) || !options.ignoreEmptyTextNode) {
				if (options.trimTextNode) cbuf = cbuf.trim()
				if (options.truncateTextNode) cbuf = truncateWhitespace(cbuf)

				node.appendChild(new Node({ type: TEXT, value: cbuf }))
			}
		} else {
			throw new Error("Unexpected end of input")
		}
	}

	return root
}

export default parse
