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
