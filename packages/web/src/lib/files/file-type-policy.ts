export const fileTypePolicy = Object.freeze({
  blockedExtensions: Object.freeze(["exe", "dll", "bat", "cmd", "ps1", "sh", "msi"]),
  reviewExtensions: Object.freeze(["zip", "html", "js", "svg"]),
  allowedDocumentExtensions: Object.freeze(["pdf", "txt", "md", "csv", "docx", "xlsx"])
});
