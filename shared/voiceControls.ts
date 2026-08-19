const labels: Record<string, string> = {
  Space: "Espaço",
  ShiftLeft: "Shift esquerdo",
  ShiftRight: "Shift direito",
  ControlLeft: "Ctrl esquerdo",
  ControlRight: "Ctrl direito",
  AltLeft: "Alt esquerdo",
  AltRight: "Alt direito",
};

const unavailableCodes = new Set(["Escape", "Tab", "MetaLeft", "MetaRight"]);

export function pushToTalkKeyLabel(code: string) {
  return labels[code] || code.replace(/^(Key|Digit)/, "");
}

export function isPushToTalkKeyAllowed(code: string) {
  return Boolean(code) && !unavailableCodes.has(code);
}
