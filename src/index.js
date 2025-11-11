import { UnexpectedTokenError, UnmatchedClosingTag } from "./utils/errors.js"
import { Node } from "virty"
import hashArray from "./utils/hashArray.js"
import isWhitespace from "./utils/isWhitespace.js"
import truncateWhitespace from "./utils/truncateWhitespace.js"

// TODO: Don't forget to handle CDATA, whatever the fuck that is...
// NOTE: Pi tags are the tags that start and end with <? --- ?>
// TODO: Need to profile, specifically one thing to check is if my whitespace trim/trunc method is speedier than a whitespace replace regex.
//       Not that this necessarily matters - I feel I have more control the way I'm doing it.
// TODO: If speed is wanted, I'll likely want to make the algo smarter so that trim/truncate processes aren't done post, but rather in place
//       as each character is parsed

/**
 * Parses the given HTML/XML data.
 *
 * @param {string|Buffer} data The HTML/XML data to parse
 * @param {object} [options]
 * @param {boolean} [options.htmlMode] Treats the document as HTML and will apply specific parsing rules as such
 * @param {boolean} [options.ignoreEmptyText] Removes any empty (whitespace only) text nodes from the results
 * @param {(snapshot: {currentChar: string, currentNodeName: string, attributesBuffer: string, characterBuffer: string, gate: string, openNodeType: string, openTagType: string, nodeBuffer: Node}) => void} [options.onSnapshot] An event fired for every character iterated, producing a snapshot of the current parse buffer; useful for debugging
 * @param {(text: string) => string} [options.onText] An event fired when a text node is about to be pushed to the results whose return string will replace the original text node's value
 * @param {string[]} [options.rawTextElements] Case-sensitive list of element names that should have their content be treated as raw text (overwritten by `options.htmlMode`)
 * @param {boolean} [options.trimAttributes] Trims whitespace on either side of attribute values
 * @param {boolean} [options.trimText] Trims whitespace on either side of text nodes
 * @param {boolean} [options.truncateAttributes] Collapses all multiple-sequenced whitespaces into a single whitespace on attribute values
 * @param {boolean} [options.truncateText] Collapses all multiple-sequenced whitespaces into a single whitespace on text nodes
 * @param {string[]} [options.voidElements] Case-sensitive list of element names that should be treated as void - i.e. elements that do not accept children (overwritten by `options.htmlMode`)
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
	if (typeof options.htmlMode !== "boolean") options.htmlMode = false
	if (typeof options.ignoreEmptyText !== "boolean") options.ignoreEmptyText = false
	if (typeof options.onSnapshot !== "function") options.onSnapshot = undefined
	if (typeof options.onText !== "function") options.onText = undefined
	if (!Array.isArray(options.rawTextElements)) options.rawTextElements = []
	options.rawTextElements = hashArray(options.rawTextElements, options.htmlMode)
	if (typeof options.trimAttributes !== "boolean") options.trimAttributes = false
	if (typeof options.trimText !== "boolean") options.trimText = false
	if (typeof options.truncateAttributes !== "boolean") options.truncateAttributes = false
	if (typeof options.truncateText !== "boolean") options.truncateText = false
	if (!Array.isArray(options.voidElements)) options.voidElements = []
	options.voidElements = hashArray(options.voidElements, options.htmlMode)
	if (options.htmlMode) {
		options.rawTextElements = {
			...options.rawTextElements,
			script: true,
			style: true,
			title: true,
			textarea: true
		}
		options.voidElements = {
			...options.voidElements,
			area: true,
			base: true,
			br: true,
			col: true,
			command: true,
			embed: true,
			hr: true,
			img: true,
			input: true,
			keygen: true,
			link: true,
			meta: true,
			param: true,
			source: true,
			track: true,
			wbr: true
		}
	}

	// Character Constants
	const LT_SIGN = "<"
	const GT_SIGN = ">"
	const EQ_SIGN = "="
	const S_QUOTE = `'`
	const D_QUOTE = `"`
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
	let node = root // default root node to get things started
	let nbuf = {} // node buffer
	let abuf = "" // attribute name buffer
	let cbuf = "" // character buffer
	let gate // filter gates dictating where the cbuf is meant to be flushed
	let ntype // node type that is currently open
	let ttype // tag type for the currently open tag declaration
	let rmode = false // raw text mode
	let rmbuf = "" // raw text mode sequence end buffer

	for (let i = 0; i < data.length; i++) {
		const char = data[i]

		if (options.onSnapshot)
			options.onSnapshot({
				currentChar: char,
				attributesBuffer: abuf,
				characterBuffer: cbuf,
				gate,
				openTag: node.tagName,
				openNodeType: ntype,
				openTagType: ttype,
				rawTextMode: rmode,
				rawTextBuffer: rmbuf
			})

		if (rmode) {
			if (char === LT_SIGN) {
				rmbuf = LT_SIGN
			} else if (char === F_SLASH) {
				if (rmbuf === LT_SIGN) {
					rmbuf = `${LT_SIGN}${F_SLASH}`
				} else {
					rmbuf = ""
				}
			} else if (char === GT_SIGN) {
				if (rmbuf.length - 2 === node.tagName.length) {
					const tnode = new Node({
						type: TEXT,
						value: cbuf.substring(0, cbuf.length - (node.tagName.length + 2))
					})

					node.appendChild(tnode)
					node = node.parent
					rmode = false
					rmbuf = ""
					cbuf = ""
					continue
				} else {
					rmbuf = ""
				}
			} else if (rmbuf.length >= 2) {
				if (node.tagName[rmbuf.length - 2] === char) {
					rmbuf = `${rmbuf}${char}`
				} else {
					rmbuf = ""
				}
			}

			cbuf = `${cbuf}${char}`
			continue
		}

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
						nbuf.tagName = options.htmlMode ? cbuf.toLowerCase() : cbuf
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
									if (options.trimAttributes) attr[1] = attr[1].trim()
									if (options.truncateAttributes) attr[1] = truncateWhitespace(attr[1])
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
						if (options.trimAttributes) cbuf = cbuf.trim()
						if (options.truncateAttributes) cbuf = truncateWhitespace(cbuf)

						nbuf.attributes[abuf] = cbuf
						abuf = ""
					} else if (!gate && abuf) {
						if (!nbuf.attributes) nbuf.attributes = {}

						nbuf.attributes[abuf] = ""
						abuf = ""
					}

					// If a tag is in rawTextElements, it should overwrite a dupe in voidElements,
					// because how the fuck can a void element have raw text in it?
					if (options.voidElements[nbuf.tagName] && !options.rawTextElements[nbuf.tagName]) ttype = SC_TAG

					if (options.rawTextElements[nbuf.tagName]) {
						rmode = true

						const nnode = new Node({
							type: ELEMENT,
							tagName: nbuf.tagName,
							attributes: nbuf.attributes
						})

						node.appendChild(nnode)
						node = nnode
					} else if (ttype === CL_TAG) {
						if (node === root) throw new UnmatchedClosingTag(i + 1)
						if (node.tagName !== nbuf.tagName && node.parent.tagName !== nbuf.tagName)
							throw new UnmatchedClosingTag(i + 1)

						node = node.parent
					} else {
						const nnode = new Node({
							type: ELEMENT,
							tagName: nbuf.tagName,
							attributes: nbuf.attributes,
							isSelfClosing: ttype === SC_TAG
						})

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
							nbuf.tagName = options.htmlMode ? cbuf.toLowerCase() : cbuf
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
							if (options.trimAttributes) cbuf = cbuf.trim()
							if (options.truncateAttributes) cbuf = truncateWhitespace(cbuf)

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
					if (options.trimAttributes) cbuf = cbuf.trim()
					if (options.truncateAttributes) cbuf = truncateWhitespace(cbuf)

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
			if (options.trimAttributes) cbuf = cbuf.trim()
			if (options.truncateAttributes) cbuf = truncateWhitespace(cbuf)

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
