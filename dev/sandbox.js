import fs from "node:fs"
import parse from "./index.js"

const toObject = classInstance => {
	const object = {}

	if (classInstance.type) object.type = classInstance.type
	if (classInstance.tagName) object.tagName = classInstance.tagName
	if (classInstance.value !== undefined) object.value = classInstance.value
	if (Object.keys(classInstance.attributes || {}).length) object.attributes = classInstance.attributes
	if (classInstance.children?.length) object.children = classInstance.children.map(toObject)

	return object
}

const data = `<p>Lorem   ipsum     dolor sit amet...  </p>`
const handleText = text => (console.log(`Found "${text}"`), text)
const o = { onText: handleText, truncateTextNode: true }
const r = parse(data, o)

console.dir(toObject(r), { depth: null })
