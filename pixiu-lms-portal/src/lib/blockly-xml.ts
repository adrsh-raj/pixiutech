/**
 * Shared structural validation for persisted and live Blockly XML.
 * Parsing is performed by the browser's XML parser; no HTML is executed.
 */
export function parseBlocklyXmlDocument(
  xml: string,
  knownBlockTypes?: Readonly<Record<string, unknown>>,
): Element {
  if (typeof xml !== "string" || !xml.trim()) {
    throw new Error("Blockly XML is empty.")
  }
  if (typeof DOMParser === "undefined") {
    throw new Error("Blockly XML could not be validated because the XML parser is unavailable.")
  }

  const document = new DOMParser().parseFromString(xml, "application/xml")
  if (document.doctype) {
    throw new Error("Blockly XML must not contain a document type declaration.")
  }
  if (document.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Blockly XML is malformed or not well-formed.")
  }

  const root = document.documentElement
  if (!root || root.tagName !== "xml") {
    throw new Error('Blockly XML must have an <xml> root element.')
  }

  const forbiddenTags = new Set(["script", "iframe", "object", "embed", "foreignobject"])
  for (const element of Array.from(root.getElementsByTagName("*"))) {
    if (forbiddenTags.has(element.tagName.toLowerCase())) {
      throw new Error(`Blockly XML contains a forbidden <${element.tagName}> element.`)
    }
  }

  if (knownBlockTypes) {
    for (const tagName of ["block", "shadow"]) {
      for (const element of Array.from(root.getElementsByTagName(tagName))) {
        const type = element.getAttribute("type")
        if (!type || !Object.prototype.hasOwnProperty.call(knownBlockTypes, type)) {
          throw new Error(type
            ? `Blockly block type "${type}" is not available in this workspace.`
            : `Blockly <${tagName}> element is missing its type.`)
        }
      }
    }
  }

  return root
}

/**
 * Validate XML syntax/root and disallow active content when a DOMParser exists.
 * Storage can also be imported in non-browser Node tests, where XML parsing is not
 * available; the live editor always calls parseBlocklyXmlDocument strictly.
 */
export function validateBlocklyXmlEnvelope(xml: string): void {
  if (typeof DOMParser === "undefined") return
  parseBlocklyXmlDocument(xml)
}
