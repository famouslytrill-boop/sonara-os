const registeredSymbol = String.fromCharCode(174);

const restrictedRegisteredMarks = [
  `SONARA Industries${registeredSymbol}`,
  `SONARA Records${registeredSymbol}`,
  `SONARA OS${registeredSymbol}`,
  `SONARA Vault${registeredSymbol}`,
  `SONARA Engine${registeredSymbol}`,
  `SONARA Exchange${registeredSymbol}`,
  `SONARA Labs${registeredSymbol}`,
];

export function validateTrademarkUsage(text: string) {
  const violations = restrictedRegisteredMarks.filter((mark) => text.includes(mark));

  return {
    isValid: violations.length === 0,
    violations,
    message:
      violations.length > 0
        ? "Use ™ instead of the registered trademark symbol until the trademark is officially registered."
        : "Trademark usage is valid.",
  };
}

export function replaceRestrictedTrademarkSymbols(text: string) {
  return text
    .replaceAll(`SONARA Industries${registeredSymbol}`, "SONARA Industries™")
    .replaceAll(`SONARA Records${registeredSymbol}`, "SONARA Records™")
    .replaceAll(`SONARA OS${registeredSymbol}`, "SONARA OS™")
    .replaceAll(`SONARA Vault${registeredSymbol}`, "SONARA Vault™")
    .replaceAll(`SONARA Engine${registeredSymbol}`, "SONARA Engine™")
    .replaceAll(`SONARA Exchange${registeredSymbol}`, "SONARA Exchange™")
    .replaceAll(`SONARA Labs${registeredSymbol}`, "SONARA Labs™");
}
