/**
 * Dependency-free validator for the JSON Schema keywords used by record-v1.schema.json.
 * This is not a complete JSON Schema 2020-12 implementation. If the schema adds a
 * keyword outside this supported subset, compilation fails rather than silently skipping it.
 */
const META_KEYWORDS = new Set(["$schema", "$id", "title", "description", "default", "examples"])
const VALIDATION_KEYWORDS = new Set([
  "type", "required", "properties", "additionalProperties", "items", "pattern", "const", "enum",
  "minLength", "maxLength", "minItems", "maxItems", "uniqueItems", "minimum", "maximum",
])
const JSON_TYPES = new Set(["object", "array", "string", "integer", "number", "boolean", "null"])

function pointer(parent, key) {
  return parent + "/" + String(key).replace(/~/g, "~0").replace(/\//g, "~1")
}

function stableJson(value) {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]"
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stableJson(value[key])).join(",") + "}"
  }
  return JSON.stringify(value)
}

function assertSupportedSchema(schema, path = "$") {
  if (typeof schema === "boolean") return
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) throw new TypeError("Invalid schema node at " + path)
  for (const key of Object.keys(schema)) {
    if (!META_KEYWORDS.has(key) && !VALIDATION_KEYWORDS.has(key)) {
      throw new Error("Unsupported JSON Schema keyword '" + key + "' at " + path)
    }
  }
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type]
    for (const type of types) {
      if (!JSON_TYPES.has(type)) throw new Error("Unsupported JSON Schema type '" + type + "' at " + path)
    }
  }
  if (schema.pattern !== undefined) {
    try { new RegExp(schema.pattern) } catch { throw new Error("Invalid schema pattern at " + path) }
  }
  if (schema.properties !== undefined) {
    if (!schema.properties || typeof schema.properties !== "object" || Array.isArray(schema.properties)) {
      throw new TypeError("Invalid properties map at " + path)
    }
    for (const [name, child] of Object.entries(schema.properties)) assertSupportedSchema(child, pointer(path, name))
  }
  if (schema.items !== undefined) assertSupportedSchema(schema.items, path + "/items")
  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    assertSupportedSchema(schema.additionalProperties, path + "/additionalProperties")
  }
}

function matchesType(value, type) {
  switch (type) {
    case "null": return value === null
    case "object": return value !== null && typeof value === "object" && !Array.isArray(value)
    case "array": return Array.isArray(value)
    case "string": return typeof value === "string"
    case "integer": return typeof value === "number" && Number.isInteger(value)
    case "number": return typeof value === "number" && Number.isFinite(value)
    case "boolean": return typeof value === "boolean"
    default: return false
  }
}

function validateNode(schema, value, path, errors) {
  if (typeof schema === "boolean") {
    if (!schema) errors.push({ instancePath: path, keyword: "falseSchema", message: "Value is not allowed" })
    return
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type]
    if (!types.some((type) => matchesType(value, type))) {
      errors.push({ instancePath: path, keyword: "type", message: "must be " + types.join(" or ") })
      return
    }
  }
  if (schema.const !== undefined && stableJson(value) !== stableJson(schema.const)) {
    errors.push({ instancePath: path, keyword: "const", message: "must equal " + JSON.stringify(schema.const) })
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => stableJson(candidate) === stableJson(value))) {
    errors.push({ instancePath: path, keyword: "enum", message: "must equal one of the allowed values" })
  }
  if (schema.pattern !== undefined && (typeof value !== "string" || !new RegExp(schema.pattern).test(value))) {
    errors.push({ instancePath: path, keyword: "pattern", message: "must match pattern " + schema.pattern })
  }
  if (typeof value === "string") {
    const length = Array.from(value).length
    if (schema.minLength !== undefined && length < schema.minLength) errors.push({ instancePath: path, keyword: "minLength", message: "must NOT have fewer than " + schema.minLength + " characters" })
    if (schema.maxLength !== undefined && length > schema.maxLength) errors.push({ instancePath: path, keyword: "maxLength", message: "must NOT have more than " + schema.maxLength + " characters" })
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push({ instancePath: path, keyword: "minimum", message: "must be >= " + schema.minimum })
    if (schema.maximum !== undefined && value > schema.maximum) errors.push({ instancePath: path, keyword: "maximum", message: "must be <= " + schema.maximum })
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push({ instancePath: path, keyword: "minItems", message: "must NOT have fewer than " + schema.minItems + " items" })
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push({ instancePath: path, keyword: "maxItems", message: "must NOT have more than " + schema.maxItems + " items" })
    if (schema.uniqueItems === true && new Set(value.map(stableJson)).size !== value.length) errors.push({ instancePath: path, keyword: "uniqueItems", message: "must NOT contain duplicate items" })
    if (schema.items !== undefined) value.forEach((item, index) => validateNode(schema.items, item, pointer(path, index), errors))
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const required = Array.isArray(schema.required) ? schema.required : []
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        errors.push({ instancePath: path, keyword: "required", message: "must have required property '" + key + "'", params: { missingProperty: key } })
      }
    }
    const properties = schema.properties || {}
    for (const [key, childSchema] of Object.entries(properties)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) validateNode(childSchema, value[key], pointer(path, key), errors)
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          errors.push({ instancePath: path, keyword: "additionalProperties", message: "must NOT have additional property '" + key + "'", params: { additionalProperty: key } })
        }
      }
    } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) validateNode(schema.additionalProperties, child, pointer(path, key), errors)
      }
    }
  }
}

export function compileRecordSchema(schema) {
  assertSupportedSchema(schema)
  const validate = (value) => {
    const errors = []
    validateNode(schema, value, "", errors)
    validate.errors = errors
    return errors.length === 0
  }
  validate.errors = []
  return validate
}
