export default function hashArray(arr, toLowerCase) {
	const hash = {}

	for (const item of arr) {
		if (toLowerCase) {
			hash[`${item}`.toLowerCase()] = true
		} else {
			hash[`${item}`] = true
		}
	}

	return hash
}
