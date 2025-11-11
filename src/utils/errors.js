export class UnexpectedTokenError extends Error {
	constructor(char, charNumber, message) {
		super(
			`Unexpected token '${char}' at character ${charNumber}${
				typeof message === "string" && message.length ? ` - ${message}` : ""
			}`
		)
		this.name = "UnexpectedTokenError"

		Error.captureStackTrace(this, UnexpectedTokenError)
	}
}

export class UnmatchedClosingTag extends Error {
	constructor(charNumber, message) {
		super(
			`A tag that was never opened is attempting to close at character ${charNumber}${
				typeof message === "string" && message.length ? ` - ${message}` : ""
			}`
		)
		this.name = "UnmatchedClosingTag"

		Error.captureStackTrace(this, UnmatchedClosingTag)
	}
}
