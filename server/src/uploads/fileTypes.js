// Tipos admitidos por extensión. "mime" es el tipo que se guarda y con el que se sirve;
// "accept" son los tipos que el navegador puede declarar para esa extensión.
// "signature" comprueba los primeros bytes del archivo cuando el formato tiene una firma conocida.

const ZIP = { signature: "zip" };
const OLE = { signature: "ole" };

export const ROOM_FILE_TYPES = {
  ".pdf": {
    mime: "application/pdf",
    accept: ["application/pdf"],
    signature: "pdf",
  },
  ".png": { mime: "image/png", accept: ["image/png"], signature: "png" },
  ".jpg": {
    mime: "image/jpeg",
    accept: ["image/jpeg", "image/pjpeg"],
    signature: "jpeg",
  },
  ".jpeg": {
    mime: "image/jpeg",
    accept: ["image/jpeg", "image/pjpeg"],
    signature: "jpeg",
  },
  ".webp": { mime: "image/webp", accept: ["image/webp"], signature: "webp" },
  ".gif": { mime: "image/gif", accept: ["image/gif"], signature: "gif" },
  ".txt": {
    mime: "text/plain",
    accept: ["text/plain", "application/octet-stream"],
  },
  ".md": {
    mime: "text/markdown",
    accept: [
      "text/markdown",
      "text/x-markdown",
      "text/plain",
      "application/octet-stream",
    ],
  },
  ".csv": {
    mime: "text/csv",
    accept: [
      "text/csv",
      "text/plain",
      "application/vnd.ms-excel",
      "application/octet-stream",
    ],
  },
  ".doc": {
    mime: "application/msword",
    accept: ["application/msword", "application/octet-stream"],
    ...OLE,
  },
  ".xls": {
    mime: "application/vnd.ms-excel",
    accept: ["application/vnd.ms-excel", "application/octet-stream"],
    ...OLE,
  },
  ".ppt": {
    mime: "application/vnd.ms-powerpoint",
    accept: ["application/vnd.ms-powerpoint", "application/octet-stream"],
    ...OLE,
  },
  ".docx": {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    accept: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/octet-stream",
    ],
    ...ZIP,
  },
  ".xlsx": {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    accept: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/octet-stream",
    ],
    ...ZIP,
  },
  ".pptx": {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    accept: [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/octet-stream",
    ],
    ...ZIP,
  },
  ".odt": {
    mime: "application/vnd.oasis.opendocument.text",
    accept: [
      "application/vnd.oasis.opendocument.text",
      "application/octet-stream",
    ],
    ...ZIP,
  },
  ".ods": {
    mime: "application/vnd.oasis.opendocument.spreadsheet",
    accept: [
      "application/vnd.oasis.opendocument.spreadsheet",
      "application/octet-stream",
    ],
    ...ZIP,
  },
  ".odp": {
    mime: "application/vnd.oasis.opendocument.presentation",
    accept: [
      "application/vnd.oasis.opendocument.presentation",
      "application/octet-stream",
    ],
    ...ZIP,
  },
  ".zip": {
    mime: "application/zip",
    accept: [
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
    ],
    ...ZIP,
  },
};

export const AVATAR_TYPES = {
  ".png": ROOM_FILE_TYPES[".png"],
  ".jpg": ROOM_FILE_TYPES[".jpg"],
  ".jpeg": ROOM_FILE_TYPES[".jpeg"],
  ".webp": ROOM_FILE_TYPES[".webp"],
};

const SIGNATURES = {
  pdf: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-",
  png: (b) =>
    b
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  gif: (b) => b.subarray(0, 4).toString("latin1") === "GIF8",
  webp: (b) =>
    b.subarray(0, 4).toString("latin1") === "RIFF" &&
    b.subarray(8, 12).toString("latin1") === "WEBP",
  zip: (b) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04,
  ole: (b) =>
    b
      .subarray(0, 8)
      .equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
};

export function matchesSignature(signature, header) {
  if (!signature) return true;
  const check = SIGNATURES[signature];
  return check ? check(header) : true;
}

export const describeExtensions = (table) =>
  Object.keys(table)
    .map((ext) => ext.slice(1).toUpperCase())
    .filter((ext, index, all) => all.indexOf(ext) === index)
    .join(", ");
