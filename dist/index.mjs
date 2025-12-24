class UnexpectedTokenError extends Error {
	constructor(char, charNumber, message) {
		super(
			`Unexpected token '${char}' at character ${charNumber}${
				typeof message === "string" && message.length ? ` - ${message}` : ""
			}`
		);
		this.name = "UnexpectedTokenError";

		Error.captureStackTrace(this, UnexpectedTokenError);
	}
}

class UnmatchedClosingTag extends Error {
	constructor(charNumber, message) {
		super(
			`A tag that was never opened is attempting to close at character ${charNumber}${
				typeof message === "string" && message.length ? ` - ${message}` : ""
			}`
		);
		this.name = "UnmatchedClosingTag";

		Error.captureStackTrace(this, UnmatchedClosingTag);
	}
}

// DESIGN NOTE: This library makes no attempt at validating the data it receives beyond ensuring it abides
// by this api's ability to interpret the data. For instance, "<" is perfectly acceptable within a text node,
// whereas in reality that's obviously disallowed. Validation is out of scope for this library and should be
// handled in the calling library.

// import isWhitespace from "./utils/isWhitespace"

const getChildren = Symbol("getChildren");
const setNext = Symbol("setNext");
const setParent = Symbol("setParent");
const setPrevious = Symbol("setPrevious");

const COMMENT = "comment";
const ELEMENT = "element";
const TEXT = "text";

class Node {
	#attributes
	#children
	#connections // just an idea to be able to connect two nodes to each other so that what happens to one happens to the other as well
	#next
	#parent
	#previous
	#isSelfClosing
	#tagName
	#type
	#value

	/**
	 * Creates a new Node - a representation of HTML/XML similar to that of a DOM node.
	 *
	 * @param {object} init (Required)
	 * @param {"comment"|"element"|"text"} init.type (Required) Case-*in*sensitive type of the node
	 * @param {string} [init.tagName] (Optional) Case-sensitive tag name, e.g. `"img"` for `<img />`. `"comment"` and `"text"` nodes will ignore this option
	 * @param {{[name: string]: string|number|boolean}} [init.attributes] (Optional) Attributes to use with `"element"` nodes. Attribute keys are case-sensitive. `"comment"` and `"text"` nodes will ignore this option
	 * @param {Node[]} [init.children] (Optional) Children to immediately populate the node with. `"comment"` and `"text"` nodes will ignore this option
	 * @param {string} [init.value] (Optional) The text to use for `"comment"` and `"text"` nodes. This is not the same as the `value` attribute. To set that, use the `init.attributes` option. `"element"` nodes will ignore this option
	 * @param {boolean} [init.isSelfClosing] (Optional) Whether the node is a self-closing tag or not. `"comment"` and `"text"` nodes will ignore this option
	 */
	constructor(init = {}) {
		if (Object.prototype.toString.call(init) !== "[object Object]")
			throw new TypeError("Expected 'init' to be an object")
		if (typeof init.type !== "string") throw new TypeError("Expected 'init.type' to be a string")

		init.type = init.type.toLowerCase();

		if (init.type !== COMMENT && init.type !== ELEMENT && init.type !== TEXT)
			throw new TypeError(`Expected 'init.type' to be one of "comment", "element", or "text"`)

		this.#type = init.type;

		if (init.type === ELEMENT) {
			if (typeof init.tagName !== "string") init.tagName = "";

			this.#tagName = init.tagName;

			if (Object.prototype.toString.call(init.attributes) !== "[object Object]") init.attributes = {};

			for (const [key, val] of Object.entries(init.attributes))
				if (typeof val !== "string" && typeof val !== "number" && typeof val !== "boolean")
					throw new TypeError(`Expected init.attributes.${key} to be string|number|boolean`)

			this.#attributes = init.attributes;
			this.#children = [];

			if (typeof init.isSelfClosing !== "boolean") init.isSelfClosing = false;

			this.#isSelfClosing = init.isSelfClosing;

			if (Array.isArray(init.children) && init.children.length) {
				if (init.isSelfClosing) throw new Error("Self-closing nodes cannot have children")

				this.appendChild(init.children);
			}
		} else if (init.type === COMMENT) {
			if (typeof init.value !== "string") init.value = "";
			else init.value = init.value.trim();

			const iv = init.value;
			const ivl = iv.length;

			if (
				ivl &&
				(iv[0] !== "<" ||
					iv[1] !== "!" ||
					iv[2] !== "-" ||
					iv[3] !== "-" ||
					iv[ivl - 3] !== "-" ||
					iv[ivl - 2] !== "-" ||
					iv[ivl - 1] !== ">")
			)
				init.value = `<!--${init.value}-->`;

			this.#value = init.value;
		} else if (init.type === TEXT) {
			if (typeof init.value !== "string") init.value = "";

			this.#value = init.value;
		}
	}

	/**
	 * Checks if the given value is a comment node.
	 *
	 * @param {unknown} value
	 * @returns {boolean}
	 */
	static isComment(value) {
		return value instanceof Node && value.type === COMMENT
	}

	/**
	 * Checks if the given value is an element node.
	 *
	 * @param {unknown} value
	 * @returns {boolean}
	 */
	static isElement(value) {
		return value instanceof Node && value.type === ELEMENT
	}

	/**
	 * Checks if the given value is a node.
	 *
	 * @param {unknown} value
	 * @returns {boolean}
	 */
	static isNode(value) {
		return value instanceof Node
	}

	/**
	 * Checks if the given value is a text node.
	 *
	 * @param {unknown} value
	 * @returns {boolean}
	 */
	static isText(value) {
		return value instanceof Node && value.type === TEXT
	}

	/**
	 * ⚠️ Protected member. Gets the unfrozen reference to the node's children.
	 *
	 * @protected
	 * @returns {Node[]|undefined}
	 */
	[getChildren]() {
		return this.#children
	}

	/**
	 *  ⚠️ Protected member. Sets the next sibling reference of the node. This method
	 * assumes no responsibility of updating any affected siblings. That responsibility
	 * lies solely with the caller.
	 *
	 * @protected
	 * @param {Node|undefined}
	 * @returns {void}
	 */
	[setNext](node) {
		if (node !== undefined && !(node instanceof Node)) throw new TypeError("Expected 'next' to be a Node or undefined")

		this.#next = node;
	}

	/**
	 *  ⚠️ Protected member. Sets the parent reference of the node. This method
	 * assumes no responsibility of updating any affected parents/children. That responsibility
	 * lies solely with the caller.
	 *
	 * @protected
	 * @param {Node|undefined}
	 * @returns {void}
	 */
	[setParent](node) {
		if (node !== undefined && (!(node instanceof Node) || node.type !== "element"))
			throw new TypeError("Expected 'parent' to be an element Node or undefined")

		this.#parent = node;
	}

	/**
	 *  ⚠️ Protected member. Sets the previous sibling reference of the node. This method
	 * assumes no responsibility of updating any affected siblings. That responsibility
	 * lies solely with the caller.
	 *
	 * @protected
	 * @param {Node|undefined}
	 * @returns {void}
	 */
	[setPrevious](node) {
		if (node !== undefined && !(node instanceof Node))
			throw new TypeError("Expected 'previous' to be a Node or undefined")

		this.#previous = node;
	}

	/**
	 * The attributes of the node. `"comment"` and `"text"` nodes do not have an attributes member.
	 *
	 * @returns {{[name: string]: string|number|boolean}|undefined}
	 */
	get attributes() {
		return this.#attributes ? { ...this.#attributes } : undefined
	}

	/**
	 * The children of the node. `"comment"` and `"text"` nodes do not have a children member.
	 *
	 * @returns {Node[]|undefined}
	 */
	get children() {
		return this.#children ? [...this.#children] : undefined
	}

	/**
	 * The first child of this node's children. `"comment"` and `"text"` nodes do not have a children member, and therefore
	 * do not have a firstChild member.
	 *
	 * @returns {Node|undefined}
	 */
	get firstChild() {
		return this.#children?.[0]
	}

	/**
	 * Checks if the node is a child of another node.
	 *
	 * @returns {boolean}
	 */
	get isChild() {
		return !!this.#parent
	}

	/**
	 * Checks if the node is the first child of another node.
	 *
	 * @returns {boolean}
	 */
	get isFirstChild() {
		return this.#parent?.firstChild === this
	}

	/**
	 * Checks if the node is a grandchild to another node.
	 *
	 * @returns {boolean}
	 */
	get isGrandchild() {
		return !!this.#parent?.parent
	}

	/**
	 * Checks if the node is a grandparent to another node.
	 *
	 * @returns {boolean}
	 */
	get isGrandparent() {
		if (!this.#children?.length) return false

		for (const child of this.#children) {
			if (child.children?.length) return true
		}

		return false
	}

	/**
	 * Checks if the node is the last child of another node.
	 *
	 * @returns {boolean}
	 */
	get isLastChild() {
		return this.#parent?.lastChild === this
	}

	/**
	 * Checks if the node is the only child of its parent.
	 *
	 * @returns {boolean}
	 */
	get isOnlyChild() {
		return this.#parent?.children?.length === 1
	}

	/**
	 * Checks if the node is a parent of another node.
	 *
	 * @returns {boolean}
	 */
	get isParent() {
		return !!this.#children?.length
	}

	/**
	 * Checks if the node is self-closing.
	 *
	 * @returns {boolean}
	 */
	get isSelfClosing() {
		return !!this.#isSelfClosing
	}

	/**
	 * Checks if the node is a sibling to another node.
	 *
	 * @returns {boolean}
	 */
	get isSibling() {
		return this.#parent?.children?.length > 1
	}

	/**
	 * The last child of this node's children. `"comment"` and `"text"` nodes do not have a children member, and therefore
	 * do not have a lastChild member.
	 *
	 * @returns {Node|undefined}
	 */
	get lastChild() {
		return this.#children ? this.#children[this.children.length - 1] : undefined
	}

	/**
	 * The next sibling node.
	 *
	 * @returns {Node|undefined}
	 */
	get next() {
		return this.#next
	}

	/**
	 * The parent node.
	 *
	 * @returns {Node|undefined}
	 */
	get parent() {
		return this.#parent
	}

	/**
	 * The previous sibling node.
	 *
	 * @returns {Node|undefined}
	 */
	get previous() {
		return this.#previous
	}

	/**
	 * The root node.
	 *
	 * @returns {Node}
	 */
	get root() {
		let qNode = this;

		while (true) {
			if (!qNode.parent) return qNode
			qNode = qNode.parent;
		}
	}

	/**
	 * The tag name of the node. `"comment"` and `"text"` nodes do not have a tagName member.
	 *
	 * @returns {string|undefined}
	 */
	get tagName() {
		return this.#tagName
	}

	/**
	 * Concatenates and returns all of the child `"text"` nodes of this node. If this node is a `"text"` node,
	 * this member is equivalent to `get Node.prototype.value()`.
	 *
	 * ⚠️ This is different from a browser web API's `.textContent` in that this simply concatenates all text nodes,
	 * whereas `.textContent` takes into account formatting whitespace of the document. See {@link https://github.com/jacoblockett/virty#nodeprototypetext- documentation}
	 * for examples showcasing why this distinction matters.
	 *
	 * @returns {string}
	 */
	get text() {
		if (this.#type === TEXT) return this.#value
		if (this.#type === COMMENT) return ""

		let result = "";

		const stack = [{ node: this, remainingChildren: [...this.#children] }];

		while (stack.length) {
			const { node, remainingChildren } = stack.shift();

			if (node.type === TEXT) {
				result = `${result}${node.value}`;
				continue
			}

			while (remainingChildren.length) {
				const child = remainingChildren.shift();

				if (child.children?.length) {
					if (remainingChildren.length) stack.unshift({ node, remainingChildren });

					stack.unshift({ node: child, remainingChildren: [...child.children] });
				} else if (child.type === TEXT) {
					result = `${result}${child.value}`;
				}
			}
		}

		return result
	}

	/**
	 * The type of the node.
	 *
	 * @returns {"comment"|"element"|"text"}
	 */
	get type() {
		return this.#type
	}

	/**
	 * The value of the node. `"element"` nodes do not have a value member.
	 *
	 * @note This is not the same as the value attribute.
	 *
	 * @returns {string|undefined}
	 */
	get value() {
		return this.#value
	}

	/**
	 * Adds the given key/value pair as an attribute to the node. If the attribute already exists, it will be
	 * overwritten.
	 *
	 * @param {string} key The attribute name
	 * @param {string|boolean|number} value The attribute's value
	 * @returns {Node} The instance itself for chaining
	 */
	addAttribute(key, value) {
		if (typeof key !== "string" || !key.length) throw new TypeError("Expected 'key' to be a string with a length >= 1")
		if (typeof value !== "string" && typeof value !== "boolean" && typeof value !== "number")
			throw new TypeError("Expected 'value' to be a string|number|boolean")

		this.#attributes[key] = value;

		return this
	}

	/**
	 * Adds the given class name(s) from the node's class list. ⚠️ This method normalizes the spacing between classes.
	 *
	 * @param {...(string|string[])[]} className The class name(s) to add
	 * @returns {Node} The instance itself for chaining
	 */
	addClass(...className) {
		if (this.#type !== ELEMENT) return this
		if (className.length === 1 && Array.isArray(className[0])) className = className[0];
		if (!this.#attributes?.class) this.#attributes.class = "";

		const split = this.#attributes.class.trim().split(/\s+/);

		for (let i = 0; i < className.length; i++) {
			if (typeof className[i] !== "string") throw new TypeError(`Expected each 'className' to be a string`)

			split.push(className[i].trim());
		}

		this.#attributes.class = [...new Set(split)].join(" ");

		return this
	}

	/**
	 * Appends the given child or children to the node. You can pass multiple nodes as arguments or an array of nodes.
	 * Appended children will lose any and all parent and sibling references should they already exist. Nodes of type
	 * "comment" and "text" will do nothing.
	 *
	 * @param {...Node|Node[]} nodes The child or children to append
	 * @returns {Node} The instance itself for chaining
	 */
	appendChild(...nodes) {
		if (this.#type !== ELEMENT) return this
		if (nodes.length === 1 && Array.isArray(nodes[0])) nodes = nodes[0];

		let p = this.#children[this.#children.length - 1];

		for (let c of nodes) {
			if (!(c instanceof Node)) throw new TypeError("Expected '...nodes' to only contain Nodes")
			if (c.parent) c.parent.removeChild(c);

			c[setParent](this);

			if (p instanceof Node) {
				p[setNext](c);
				c[setPrevious](p);
			}

			this.#children.push(c);
			p = c;
		}

		return this
	}

	/**
	 * Appends the given sibling or siblings to the node. You can pass multiple nodes as arguments or an array of nodes.
	 * Appended siblings will lose any and all parent and sibling references should they already exist.
	 *
	 * @param {...Node|Node[]} nodes The sibling or siblings to append
	 * @returns {Node} The instance itself for chaining
	 */
	appendSibling(...nodes) {
		if (nodes.length === 1 && Array.isArray(nodes[0])) nodes = nodes[0];
		if (!this.#parent) throw new Error("Cannot append a siblings to nodes without a parent (root nodes)")

		const p = this.#parent;
		const pc = p[getChildren]();

		if (pc[pc.length - 1] === this) {
			this.#parent.appendChild(...nodes);
			return this
		}

		pc.splice(pc.indexOf(this) + 1, 0, ...nodes);

		for (let i = 0; i < pc.length; i++) {
			const c = pc[i];

			if (!(c instanceof Node)) throw new TypeError("Expected ...nodes to only contain Nodes")

			c[setParent](p);
			c[setPrevious](pc[i - 1]);
			c[setNext](pc[i + 1]);
		}

		return this
	}

	/**
	 * Checks if the node is a child of the given node.
	 *
	 * @returns {boolean}
	 */
	isChildOf(node) {
		return this.#parent === node
	}

	/**
	 * Checks if the node is a parent to the given node.
	 *
	 * @returns {boolean}
	 */
	isParentOf(node) {
		return this.#children ? this.#children.includes(node) : false
	}

	/**
	 * Prepends the given child or children to the node. You can pass multiple nodes as arguments or an array of nodes.
	 * Prepended children will lose any and all parent and sibling references should they already exist. Nodes of type
	 * "comment" and "text" will do nothing.
	 *
	 * @param {...Node|Node[]} nodes The child or children to prepend
	 * @returns {Node} The instance itself for chaining
	 */
	prependChild(...nodes) {
		if (this.#type !== ELEMENT) return this
		if (nodes.length === 1 && Array.isArray(nodes[0])) nodes = nodes[0];

		let p = this.#children[this.#children.length - 1];

		for (let c of nodes) {
			if (!(c instanceof Node)) throw new TypeError("Expected '...nodes' to only contain Nodes")
			if (c.parent) c.parent.removeChild(c);

			c[setParent](this);

			if (p instanceof Node) {
				p[setNext](c);
				c[setPrevious](p);
			}

			this.#children.unshift(c);
			p = c;
		}

		return this
	}

	/**
	 * Prepends the given sibling or siblings to the node. You can pass multiple nodes as arguments or an array of nodes.
	 * Prepended siblings will lose any and all parent and sibling references should they already exist.
	 *
	 * @param {...Node|Node[]} nodes The sibling or siblings to prepend
	 * @returns {Node} The instance itself for chaining
	 */
	prependSibling(...nodes) {
		if (nodes.length === 1 && Array.isArray(nodes[0])) nodes = nodes[0];
		if (!this.#parent) throw new Error("Cannot prepend a siblings to nodes without a parent (root nodes)")

		const p = this.#parent;
		const pc = p[getChildren]();

		if (pc[pc.length - 1] === this) {
			this.#parent.appendChild(...nodes);
			return this
		}

		pc.splice(pc.indexOf(this), 0, ...nodes);

		for (let i = 0; i < pc.length; i++) {
			const c = pc[i];

			if (!(c instanceof Node)) throw new TypeError("Expected ...nodes to only contain Nodes")

			c[setParent](p);
			c[setPrevious](pc[i - 1]);
			c[setNext](pc[i + 1]);
		}

		return this
	}

	/**
	 * Removes the given key/value pair as an attribute to the node. If the attribute does not alreayd exist this
	 * method will do nothing.
	 *
	 * @param {string} key The attribute name
	 * @returns {Node} The instance itself for chaining
	 */
	removeAttribute(key) {
		if (this.#type !== ELEMENT) return this
		if (typeof key !== "string" || !key.length) throw new TypeError("Expected 'key' to be a string with a length >= 1")

		delete this.#attributes[key];

		return this
	}

	/**
	 * Checks if the attribute exists on the node.
	 *
	 * @param {string} attributeName
	 * @returns {boolean}
	 */
	hasAttribute(attributeName) {
		return Object.hasOwn(this.#attributes, attributeName)
	}

	/**
	 * Gets the nth child from the node. Children are indexed by 1, not by 0.
	 * Negative numbers will work from the last child to the first.
	 *
	 * @param {number} n The nth child to get
	 * @returns {Node|undefined} The child, or undefined if it doesn't exist
	 */
	nthChild(n) {
		if (!!this.#children) return undefined

		const idx = n > 0 ? n - 1 : this.#children.length + n;

		if (idx < 0 || idx >= this.#children.length) return undefined

		return this.#children[idx]
	}

	/**
	 * Removes the given child or children from the node. You can pass multiple nodes as arguments or an array of
	 * nodes. Nodes of type "comment" and "text", and nodes with no children, will do nothing.
	 *
	 * @param {...Node|Node[]} nodes The child or children to remove
	 * @returns {Node} The instance itself for chaining
	 */
	removeChild(...nodes) {
		if (this.#type !== ELEMENT || !this.#children.length) return this
		if (nodes.length === 1 && Array.isArray(nodes[0])) nodes = nodes[0];

		const remaining = [];

		for (const c of this.#children) {
			if (!nodes.includes(c)) {
				remaining.push(c);
				continue
			}

			if (c.previous) c.previous[setNext](c.next);
			if (c.next) c.next[setPrevious](c.previous);

			c[setNext](undefined);
			c[setParent](undefined);
			c[setPrevious](undefined);
		}

		this.#children = remaining;

		return this
	}

	/**
	 * Removes the given class name(s) from the node's class list. ⚠️ This method normalizes the spacing between classes.
	 *
	 * @param {...(string|string[])[]} className The class name(s) to remove
	 * @returns {Node} The instance itself for chaining
	 */
	removeClass(...className) {
		if (this.#type !== ELEMENT) return this
		if (className.length === 1 && Array.isArray(className[0])) className = className[0];
		if (!this.#attributes?.class) return this

		this.#attributes.class = this.#attributes.class
			.trim()
			.split(/\s+/)
			.filter(cn => {
				if (typeof cn !== "string") throw new TypeError("Expected each 'className' to be a string")

				return !className.includes(cn)
			})
			.join(" ");

		return this
	}

	/**
	 * Toggles the class name(s) within the node's class list.
	 *
	 * @param {...(string|string[])[]} className The class name(s) to toggle
	 * @returns {Node} The instance itself for chaining
	 */
	toggleClass(...className) {
		if (className.length === 1 && Array.isArray(className[0])) className = className[0];

		className = [...new Set(className.map(cn => cn.trim()))];

		if (!this.#attributes?.class) this.#attributes.class = "";

		const classList = this.#attributes.class
			.trim()
			.split(/\s+/)
			.reduce((p, c) => {
				p[c] = true;
				return p
			}, {});

		for (const cn of className) {
			if (classList[cn]) {
				delete classList[cn];
			} else {
				classList[cn] = true;
			}
		}

		this.#attributes.class = Object.keys(classList).join(" ");
	}

	/**
	 * Converts the current node and all of its children into JavaScript objects.
	 *
	 * @returns {object}
	 */
	toObject() {
		const object = {};

		if (this.type) object.type = this.type;
		if (this.tagName) object.tagName = this.tagName;
		if (this.value !== undefined) object.value = this.value;
		if (Object.keys(this.attributes || {}).length) object.attributes = this.attributes;
		if (this.children?.length) object.children = this.children.map(child => child.toObject());

		return object
	}

	/**
	 * Renders the current node and all of its children into a string.
	 *
	 * @param {object} [options]
	 * @param {string} [options.indentChar] The character to use for indentation (default: `""`)
	 * @param {number} [options.indentSize] The number of times to use the indentation character (default: `0`)
	 * @param {number} [options.printWidth] The maximum visual column size to print before wrapping to the next line (default: `100`) ⚠️ Planned, but not implemented
	 * @returns {string}
	 */
	toString(options = {}) {
		if (Object.prototype.toString.call(options) !== "[object Object]") options = {};
		if (typeof options.indentChar !== "string") options.indentChar = "";
		if (typeof options.indentSize !== "number" || !Number.isInteger(options.indentSize)) options.indentSize = 0;

		let str = "";
		let q = [{ node: this, depth: 0 }];

		while (q.length) {
			const { node, depth, requeued } = q.shift();
			const indent =
				depth && options.indentSize && options.indentChar
					? `${options.indentChar}`.repeat(depth * options.indentSize)
					: "";

			if (node.type === ELEMENT) {
				const newline = options.indentSize ? "\n" : "";

				if (requeued) {
					// handle closing tag
					str += `${indent}</${node.tagName}>${newline}`;
					continue
				}

				// handle opening tag
				const a = `${Object.entries(node.attributes).reduce((p, [k, v]) => `${p} ${k}="${v}"`, "")}`;
				str += `${indent}<${node.tagName}${a}${node.isSelfClosing ? " /" : ""}>${
					node.children.length || node.isSelfClosing ? newline : ""
				}`;

				if (node.isSelfClosing) continue

				// handle nested children
				if (node.children.length && !requeued) {
					const children = node.children.map(c => ({ node: c, depth: depth + 1 }));

					q.unshift(...children, { node, depth, requeued: true });
					continue
				}

				// handle closing tag
				str += `${node.children.length ? indent : ""}</${node.tagName}>${newline}`;
				continue
			} else if (node.type === TEXT) {
				str += `${indent}${node.value}${options.indentSize ? "\n" : ""}`;
				continue
			} else if (node.type === COMMENT) {
				str += `${indent}${node.value}${options.indentSize ? "\n" : ""}`;
				continue
			}
		}

		return str
	}

	query(queryString) {
		if (typeof queryString !== "string") throw new TypeError("Expected 'queryString' to be a string")
		if (!queryString.length) return undefined

		for (const char of queryString) {
		}
	}
}

function hashArray(arr, toLowerCase) {
	const hash = {};

	for (const item of arr) {
		if (toLowerCase) {
			hash[`${item}`.toLowerCase()] = true;
		} else {
			hash[`${item}`] = true;
		}
	}

	return hash
}

// Whitespace characters
const CHARACTER_TABULATION = "\u0009";
const LINE_FEED = "\u000A";
const LINE_TABULATION = "\u000B";
const FORM_FEED = "\u000C";
const CARRIAGE_RETURN = "\u000D";
const SPACE = "\u0020";
const NEXT_LINE = "\u0085";
const NO_BREAK_SPACE = "\u00A0";
const OGHAM_SPACE_MARK = "\u1680";
const EN_QUAD = "\u2000";
const EM_QUAD = "\u2001";
const EN_SPACE = "\u2002";
const EM_SPACE = "\u2003";
const THREE_PER_EM_SPACE = "\u2004";
const FOUR_PER_EM_SPACE = "\u2005";
const SIX_PER_EM_SPACE = "\u2006";
const FIGURE_SPACE = "\u2007";
const PUNCTUATION_SPACE = "\u2008";
const THIN_SPACE = "\u2009";
const HAIR_SPACE = "\u200A";
const LINE_SEPARATOR = "\u2028";
const PARAGRAPH_SEPARATOR = "\u2029";
const NARROW_NO_BREAK_SPACE = "\u202F";
const MEDIUM_MATHEMATICAL_SPACE = "\u205F";
const IDEOGRAPHIC_SPACE = "\u3000";
const MONGOLIAN_VOWEL_SEPARATOR = "\u180E";
const ZERO_WIDTH_SPACE = "\u200B";
const ZERO_WIDTH_NON_JOINER = "\u200C";
const ZERO_WIDTH_JOINER = "\u200D";
const WORD_JOINER = "\u2060";
const ZERO_WIDTH_NON_BREAKING_SPACE = "\uFEFF";

// Whitespace symbolic images
const MIDDLE_DOT = "\u00B7";
const DOWNWARDS_TWO_HEADED_ARROW = "\u21A1";
const IDENTICAL_TO = "\u2261";
const SHOULDERED_OPEN_BOX = "\u237D";
const RETURN_SYMBOL = "\u23CE";
const SYMBOL_FOR_HORIZONTAL_TABULATION = "\u2409";
const SYMBOL_FOR_LINE_FEED = "\u240A";
const SYMBOL_FOR_VERTICAL_TABULATION = "\u240B";
const SYMBOL_FOR_FORM_FEED = "\u240C";
const SYMBOL_FOR_CARRIAGE_RETURN = "\u240D";
const SYMBOL_FOR_SPACE = "\u2420";
const BLANK_SYMBOL = "\u2422";
const OPEN_BOX = "\u2423";
const SYMBOL_FOR_NEWLINE = "\u2424";
const WHITE_UP_POINTING_TRIANGLE = "\u25B3";
const LOGICAL_OR_WITH_MIDDLE_STEM = "\u2A5B";
const SMALLER_THAN = "\u2AAA";
const LARGER_THAN = "\u2AAB";
const IDEOGRAPHIC_TELEGRAPH_LINE_FEED_SEPARATOR_SYMBOL = "\u3037";

/**
 * Checks if the given character is a whitespace character. This function considers whitespace to be any character
 * outlined on https://en.wikipedia.org/wiki/Whitespace_character.
 *
 * @param {unknown} char The character to evaluate
 * @param {boolean} includeSymbols Include symbolic images representing whitespace
 * @returns {boolean}
 */
function isWhitespace(char, includeSymbols = false) {
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

/**
 * Truncates all multiple-sequenced whitespace characters into a single space (U+0020) character.
 *
 * @param {string} string The string to truncate whitespace from
 * @param {boolean} includeSymbols Include symbolic images representing whitespace (passthrough arg to utils/isWhitespace.js)
 * @returns {string}
 */
function truncateWhitespace(string, includeSymbols = false) {
	if (typeof string !== "string") throw new TypeError("Expected 'string' to be a sting")

	let n = "";

	for (let c of string) {
		const p = n[n.length - 1];

		if (isWhitespace(c, includeSymbols)) {
			if (p === "\u0020") continue

			n = `${n}\u0020`;
			continue
		}

		n = `${n}${c}`;
	}

	return n
}

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
	if (Buffer.isBuffer(data)) data = data.toString();

	data = data.trim();

	// Set default options
	if (Object.prototype.toString.call(options) !== "[object Object]") options = {};
	if (typeof options.htmlMode !== "boolean") options.htmlMode = false;
	if (typeof options.ignoreEmptyText !== "boolean") options.ignoreEmptyText = false;
	if (typeof options.onSnapshot !== "function") options.onSnapshot = undefined;
	if (typeof options.onText !== "function") options.onText = undefined;
	if (!Array.isArray(options.rawTextElements)) options.rawTextElements = [];
	options.rawTextElements = hashArray(options.rawTextElements, options.htmlMode);
	if (typeof options.trimAttributes !== "boolean") options.trimAttributes = false;
	if (typeof options.trimText !== "boolean") options.trimText = false;
	if (typeof options.truncateAttributes !== "boolean") options.truncateAttributes = false;
	if (typeof options.truncateText !== "boolean") options.truncateText = false;
	if (!Array.isArray(options.voidElements)) options.voidElements = [];
	options.voidElements = hashArray(options.voidElements, options.htmlMode);
	if (options.htmlMode) {
		options.rawTextElements = {
			...options.rawTextElements,
			script: true,
			style: true,
			title: true,
			textarea: true
		};
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
		};
	}

	// Character Constants
	const LT_SIGN = "<";
	const GT_SIGN = ">";
	const EQ_SIGN = "=";
	const S_QUOTE = `'`;
	const D_QUOTE = `"`;
	const F_SLASH = "/";
	const BANG = "!";
	const DASH = "-";

	// Gates
	const TAG_NAME = "tag name";
	const ATT_NAME = "attribute name";
	const SQ_A_VAL = "single-quote attribute value";
	const DQ_A_VAL = "double-quote attribute value";
	const NQ_A_VAL = "no-quote attribute value";

	// Node Types
	const COMMENT = "comment";
	const ELEMENT = "element";
	const TEXT = "text";

	// Tag Types
	const CL_TAG = "closing tag";
	const SC_TAG = "self-closing tag";

	// Loop Dependents
	const root = new Node({ type: ELEMENT, tagName: "ROOT" });
	let node = root; // default root node to get things started
	let nbuf = {}; // node buffer
	let abuf = ""; // attribute name buffer
	let cbuf = ""; // character buffer
	let gate; // filter gates dictating where the cbuf is meant to be flushed
	let ntype; // node type that is currently open
	let ttype; // tag type for the currently open tag declaration
	let rmode = false; // raw text mode
	let rmbuf = ""; // raw text mode sequence end buffer

	for (let i = 0; i < data.length; i++) {
		const char = data[i];

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
			});

		if (rmode) {
			if (char === LT_SIGN) {
				rmbuf = LT_SIGN;
			} else if (char === F_SLASH) {
				if (rmbuf === LT_SIGN) {
					rmbuf = `${LT_SIGN}${F_SLASH}`;
				} else {
					rmbuf = "";
				}
			} else if (char === GT_SIGN) {
				if (rmbuf.length - 2 === node.tagName.length) {
					const tnode = new Node({
						type: TEXT,
						value: cbuf.substring(0, cbuf.length - (node.tagName.length + 2))
					});

					node.appendChild(tnode);
					node = node.parent;
					rmode = false;
					rmbuf = "";
					cbuf = "";
					continue
				} else {
					rmbuf = "";
				}
			} else if (rmbuf.length >= 2) {
				if (node.tagName[rmbuf.length - 2] === char) {
					rmbuf = `${rmbuf}${char}`;
				} else {
					rmbuf = "";
				}
			}

			cbuf = `${cbuf}${char}`;
			continue
		}

		if (char === LT_SIGN) {
			if (ttype === SC_TAG) throw new UnexpectedTokenError(char, i + 1)
			if (ntype === ELEMENT && gate !== SQ_A_VAL && gate !== DQ_A_VAL) throw new UnexpectedTokenError(char, i + 1)

			if (!ntype) {
				ntype = ELEMENT;
				gate = TAG_NAME;
				continue
			} else if (ntype === TEXT) {
				ntype = ELEMENT;
				gate = TAG_NAME;

				if (options.onText) {
					cbuf = options.onText(cbuf);

					if (typeof cbuf !== "string") throw new Error("Expected the result of 'onText' to be a string")
				}
				if (options.trimText) cbuf = cbuf.trim();
				if (options.truncateText) cbuf = truncateWhitespace(cbuf);
				if (options.ignoreEmptyText && !cbuf.trim().length) {
					cbuf = "";
					continue
				}

				node.appendChild(new Node({ type: TEXT, value: cbuf }));
				cbuf = "";
				continue
			}
		} else if (char === GT_SIGN) {
			if (ntype === ELEMENT) {
				if (gate !== SQ_A_VAL && gate !== DQ_A_VAL) {
					if (gate === TAG_NAME) {
						nbuf.tagName = options.htmlMode ? cbuf.toLowerCase() : cbuf;
					} else if (gate === ATT_NAME) {
						if (!nbuf.attributes) nbuf.attributes = {};
						if (options.onAttribute) {
							const attr = options.onAttribute(cbuf, "", { tagName: nbuf.tagName, attributes: { ...nbuf.attributes } });

							if (
								Array.isArray(attr) &&
								typeof attr[0] === "string" &&
								attr[0].length &&
								(typeof attr[1] === "string" || typeof attr[1] === "number" || typeof attr[1] === "boolean")
							) {
								if (typeof attr[1] === "string") {
									if (options.trimAttributes) attr[1] = attr[1].trim();
									if (options.truncateAttributes) attr[1] = truncateWhitespace(attr[1]);
								}

								nbuf.attributes[attr[0]] = attr[1];
								// TO FUTURE JACOB: Trying desperately to figure out the best way to implement the event functions.
								// Seems like providing contextual information would be the best way to go, but to what end? Should
								// I provide the working nodes, buffer node, and all buffers? How do I present that, or whatever I
								// end up providing? That kind of thing.
							}
						} else {
							nbuf.attributes[cbuf] = "";
						}
					} else if (gate === NQ_A_VAL) {
						if (!nbuf.attributes) nbuf.attributes = {};
						if (options.trimAttributes) cbuf = cbuf.trim();
						if (options.truncateAttributes) cbuf = truncateWhitespace(cbuf);

						nbuf.attributes[abuf] = cbuf;
						abuf = "";
					} else if (!gate && abuf) {
						if (!nbuf.attributes) nbuf.attributes = {};

						nbuf.attributes[abuf] = "";
						abuf = "";
					}

					// If a tag is in rawTextElements, it should overwrite a dupe in voidElements,
					// because how the fuck can a void element have raw text in it?
					if (options.voidElements[nbuf.tagName] && !options.rawTextElements[nbuf.tagName]) ttype = SC_TAG;

					if (options.rawTextElements[nbuf.tagName]) {
						rmode = true;

						const nnode = new Node({
							type: ELEMENT,
							tagName: nbuf.tagName,
							attributes: nbuf.attributes
						});

						node.appendChild(nnode);
						node = nnode;
					} else if (ttype === CL_TAG) {
						if (node === root) throw new UnmatchedClosingTag(i + 1)
						if (node.tagName !== nbuf.tagName && node.parent.tagName !== nbuf.tagName)
							throw new UnmatchedClosingTag(i + 1)

						node = node.parent;
					} else {
						const nnode = new Node({
							type: ELEMENT,
							tagName: nbuf.tagName,
							attributes: nbuf.attributes,
							isSelfClosing: ttype === SC_TAG
						});

						node.appendChild(nnode);

						if (ttype !== SC_TAG) node = nnode;
					}

					cbuf = "";
					nbuf = {};
					gate = undefined;
					ntype = undefined;
					ttype = undefined;
					continue
				}
			} else if (ntype === COMMENT) {
				if (cbuf[cbuf.length - 2] === DASH && cbuf[cbuf.length - 1] === DASH) {
					node.appendChild(new Node({ type: COMMENT, value: `${cbuf}${char}` }));
					cbuf = "";
					ntype = undefined;

					continue
				}
			}
		} else if (isWhitespace(char)) {
			if (ntype === ELEMENT) {
				if (!gate) continue

				if (gate !== SQ_A_VAL && gate !== DQ_A_VAL) {
					if (cbuf) {
						if (gate === TAG_NAME) {
							nbuf.tagName = options.htmlMode ? cbuf.toLowerCase() : cbuf;
							cbuf = "";
							gate = undefined;
							continue
						} else if (gate === ATT_NAME) {
							abuf = cbuf;
							cbuf = "";
							gate = undefined;
							continue
						} else if (gate === NQ_A_VAL) {
							if (!nbuf.attributes) nbuf.attributes = {};
							if (options.trimAttributes) cbuf = cbuf.trim();
							if (options.truncateAttributes) cbuf = truncateWhitespace(cbuf);

							nbuf.attributes[abuf] = cbuf;
							abuf = "";
							cbuf = "";
							gate = undefined;
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
						ttype = SC_TAG;
						nbuf.tagName = cbuf;
						cbuf = "";
						gate = undefined;
						continue
					} else {
						ttype = CL_TAG;
						continue
					}
				} else if (gate === NQ_A_VAL) {
					ttype = SC_TAG;

					if (!nbuf.attributes) nbuf.attributes = {};
					if (options.trimAttributes) cbuf = cbuf.trim();
					if (options.truncateAttributes) cbuf = truncateWhitespace(cbuf);

					nbuf.attributes[abuf] = cbuf;
					abuf = "";
					cbuf = "";
					gate = undefined;
					continue
				} else if (!gate) {
					ttype = SC_TAG;
					continue
				}
			}
		} else if (char === EQ_SIGN) {
			if (gate === ATT_NAME) {
				abuf = cbuf;
				cbuf = EQ_SIGN;
				gate = undefined;
				continue
			}
		} else if ((char === S_QUOTE && gate === SQ_A_VAL) || (char === D_QUOTE && gate === DQ_A_VAL)) {
			if (!nbuf.attributes) nbuf.attributes = {};
			if (options.trimAttributes) cbuf = cbuf.trim();
			if (options.truncateAttributes) cbuf = truncateWhitespace(cbuf);

			nbuf.attributes[abuf] = cbuf;
			abuf = "";
			cbuf = "";
			gate = undefined;
			continue
		} else if (ntype === ELEMENT) {
			if (gate === TAG_NAME) {
				if (cbuf[0] === BANG && cbuf[1] === DASH && char === DASH) {
					cbuf = "<!--";
					gate = undefined;
					ntype = COMMENT;
					continue
				}
			} else if (!gate) {
				if (abuf) {
					if (cbuf === EQ_SIGN) {
						if (char === S_QUOTE || char === D_QUOTE) {
							cbuf = "";

							if (char === S_QUOTE) {
								gate = SQ_A_VAL;
							} else if (char === D_QUOTE) {
								gate = DQ_A_VAL;
							}

							continue
						} else {
							cbuf = char;
							gate = NQ_A_VAL;
							continue
						}
					} else if (!cbuf) {
						if (!nbuf.attributes) nbuf.attributes = {};

						nbuf.attributes[abuf] = "";
						abuf = "";
						gate = ATT_NAME;
					}
				} else if (nbuf.tagName) {
					gate = ATT_NAME;
				}
			}
		}

		if (!ntype) ntype = TEXT;

		cbuf = `${cbuf}${char}`;
	}

	if (cbuf) {
		if (ntype === TEXT) {
			if (options.onText) {
				cbuf = options.onText(cbuf);

				if (typeof cbuf !== "string") throw new Error("Expected the result of 'onText' to be a string")
			}
			if (options.trimText) cbuf = cbuf.trim();
			if (options.truncateText) cbuf = truncateWhitespace(cbuf);
			if (options.ignoreEmptyText && !cbuf.length) return root

			node.appendChild(new Node({ type: TEXT, value: cbuf }));
		} else {
			throw new Error("Unexpected end of input")
		}
	}

	return root
}

export { parse as default };
