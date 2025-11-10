// Whitespace characters
const CHARACTER_TABULATION = "\u0009"
const LINE_FEED = "\u000A"
const LINE_TABULATION = "\u000B"
const FORM_FEED = "\u000C"
const CARRIAGE_RETURN = "\u000D"
const SPACE = "\u0020"
const NEXT_LINE = "\u0085"
const NO_BREAK_SPACE = "\u00A0"
const OGHAM_SPACE_MARK = "\u1680"
const EN_QUAD = "\u2000"
const EM_QUAD = "\u2001"
const EN_SPACE = "\u2002"
const EM_SPACE = "\u2003"
const THREE_PER_EM_SPACE = "\u2004"
const FOUR_PER_EM_SPACE = "\u2005"
const SIX_PER_EM_SPACE = "\u2006"
const FIGURE_SPACE = "\u2007"
const PUNCTUATION_SPACE = "\u2008"
const THIN_SPACE = "\u2009"
const HAIR_SPACE = "\u200A"
const LINE_SEPARATOR = "\u2028"
const PARAGRAPH_SEPARATOR = "\u2029"
const NARROW_NO_BREAK_SPACE = "\u202F"
const MEDIUM_MATHEMATICAL_SPACE = "\u205F"
const IDEOGRAPHIC_SPACE = "\u3000"
const MONGOLIAN_VOWEL_SEPARATOR = "\u180E"
const ZERO_WIDTH_SPACE = "\u200B"
const ZERO_WIDTH_NON_JOINER = "\u200C"
const ZERO_WIDTH_JOINER = "\u200D"
const WORD_JOINER = "\u2060"
const ZERO_WIDTH_NON_BREAKING_SPACE = "\uFEFF"

// Whitespace symbolic images
const MIDDLE_DOT = "\u00B7"
const DOWNWARDS_TWO_HEADED_ARROW = "\u21A1"
const IDENTICAL_TO = "\u2261"
const SHOULDERED_OPEN_BOX = "\u237D"
const RETURN_SYMBOL = "\u23CE"
const SYMBOL_FOR_HORIZONTAL_TABULATION = "\u2409"
const SYMBOL_FOR_LINE_FEED = "\u240A"
const SYMBOL_FOR_VERTICAL_TABULATION = "\u240B"
const SYMBOL_FOR_FORM_FEED = "\u240C"
const SYMBOL_FOR_CARRIAGE_RETURN = "\u240D"
const SYMBOL_FOR_SPACE = "\u2420"
const BLANK_SYMBOL = "\u2422"
const OPEN_BOX = "\u2423"
const SYMBOL_FOR_NEWLINE = "\u2424"
const WHITE_UP_POINTING_TRIANGLE = "\u25B3"
const LOGICAL_OR_WITH_MIDDLE_STEM = "\u2A5B"
const SMALLER_THAN = "\u2AAA"
const LARGER_THAN = "\u2AAB"
const IDEOGRAPHIC_TELEGRAPH_LINE_FEED_SEPARATOR_SYMBOL = "\u3037"

/**
 * Checks if the given character is a whitespace character. This function considers whitespace to be any character
 * outlined on https://en.wikipedia.org/wiki/Whitespace_character.
 *
 * @param {unknown} char The character to evaluate
 * @param {boolean} includeSymbols Include symbolic images representing whitespace
 * @returns {boolean}
 */
export default function isWhitespace(char, includeSymbols = false) {
	if (char === CHARACTER_TABULATION) return true
	if (char === LINE_FEED) return true
	if (char === LINE_TABULATION) return true
	if (char === FORM_FEED) return true
	if (char === CARRIAGE_RETURN) return true
	if (char === SPACE) return true
	if (char === NEXT_LINE) return true
	if (char === NO_BREAK_SPACE) return true
	if (char === OGHAM_SPACE_MARK) return true
	if (char === EN_QUAD) return true
	if (char === EM_QUAD) return true
	if (char === EN_SPACE) return true
	if (char === EM_SPACE) return true
	if (char === THREE_PER_EM_SPACE) return true
	if (char === FOUR_PER_EM_SPACE) return true
	if (char === SIX_PER_EM_SPACE) return true
	if (char === FIGURE_SPACE) return true
	if (char === PUNCTUATION_SPACE) return true
	if (char === THIN_SPACE) return true
	if (char === HAIR_SPACE) return true
	if (char === LINE_SEPARATOR) return true
	if (char === PARAGRAPH_SEPARATOR) return true
	if (char === NARROW_NO_BREAK_SPACE) return true
	if (char === MEDIUM_MATHEMATICAL_SPACE) return true
	if (char === IDEOGRAPHIC_SPACE) return true
	if (char === MONGOLIAN_VOWEL_SEPARATOR) return true
	if (char === ZERO_WIDTH_SPACE) return true
	if (char === ZERO_WIDTH_NON_JOINER) return true
	if (char === ZERO_WIDTH_JOINER) return true
	if (char === WORD_JOINER) return true
	if (char === ZERO_WIDTH_NON_BREAKING_SPACE) return true
	if (includeSymbols) {
		if (char === MIDDLE_DOT) return true
		if (char === DOWNWARDS_TWO_HEADED_ARROW) return true
		if (char === IDENTICAL_TO) return true
		if (char === SHOULDERED_OPEN_BOX) return true
		if (char === RETURN_SYMBOL) return true
		if (char === SYMBOL_FOR_HORIZONTAL_TABULATION) return true
		if (char === SYMBOL_FOR_LINE_FEED) return true
		if (char === SYMBOL_FOR_VERTICAL_TABULATION) return true
		if (char === SYMBOL_FOR_FORM_FEED) return true
		if (char === SYMBOL_FOR_CARRIAGE_RETURN) return true
		if (char === SYMBOL_FOR_SPACE) return true
		if (char === BLANK_SYMBOL) return true
		if (char === OPEN_BOX) return true
		if (char === SYMBOL_FOR_NEWLINE) return true
		if (char === WHITE_UP_POINTING_TRIANGLE) return true
		if (char === LOGICAL_OR_WITH_MIDDLE_STEM) return true
		if (char === SMALLER_THAN) return true
		if (char === LARGER_THAN) return true
		if (char === IDEOGRAPHIC_TELEGRAPH_LINE_FEED_SEPARATOR_SYMBOL) return true
	}

	return false
}
