const REQUIRED_EDGE_STYLE: Record<string, string> = {
  edgeStyle: "orthogonalEdgeStyle",
  rounded: "1",
  orthogonalLoop: "1",
  jettySize: "auto",
  html: "1",
};

function parseStyle(style: string) {
  const map = new Map<string, string>();
  style
    .split(";")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .forEach((segment) => {
      const [key, ...valueParts] = segment.split("=");
      if (key) {
        map.set(key, valueParts.join("="));
      }
    });
  return map;
}

function stringifyStyle(map: Map<string, string>) {
  return Array.from(map.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join(";") + (map.size ? ";" : "");
}

function sanitizeEdgeCell(cell: Element) {
  const geometry = cell.getElementsByTagName("mxGeometry")?.[0];
  if (geometry) {
    const arrays = geometry.getElementsByTagName("Array");
    while (arrays.length > 0) {
      geometry.removeChild(arrays[0]);
    }
  }

  const styleMap = parseStyle(cell.getAttribute("style") || "");
  Object.entries(REQUIRED_EDGE_STYLE).forEach(([key, value]) => {
    styleMap.set(key, value);
  });
  cell.setAttribute("style", stringifyStyle(styleMap));
}

export function sanitizeDiagramXml(xml: string): string {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return xml;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    if (doc.getElementsByTagName("parsererror").length) {
      return xml;
    }

    const cells = doc.getElementsByTagName("mxCell");
    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      if (cell.getAttribute("source") && cell.getAttribute("target")) {
        sanitizeEdgeCell(cell);
      }
    }

    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  } catch {
    return xml;
  }
}
