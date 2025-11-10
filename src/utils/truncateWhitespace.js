import isWhitespace from "./isWhitespace.js"

/**
 * Truncates all multiple-sequenced whitespace characters into a single space (U+0020) character.
 *
 * @param {string} string The string to truncate whitespace from
 * @param {boolean} includeSymbols Include symbolic images representing whitespace (passthrough arg to utils/isWhitespace.js)
 * @returns {string}
 */
export default function truncateWhitespace(string, includeSymbols = false) {
	if (typeof string !== "string") throw new TypeError("Expected 'string' to be a sting")

	let n = ""

	for (let c of string) {
		const p = n[n.length - 1]

		if (isWhitespace(c, includeSymbols)) {
			if (p === "\u0020") continue

			n = `${n}\u0020`
			continue
		}

		n = `${n}${c}`
	}

	return n
}
