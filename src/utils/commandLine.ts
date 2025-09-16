export function applyTemplate(input: string, replacements: Record<string, string>): string {
  return input.replace(/{{\s*([^}]+)\s*}}/g, (match, key) => {
    const trimmed = key.trim();
    return Object.prototype.hasOwnProperty.call(replacements, trimmed)
      ? replacements[trimmed]
      : "";
  });
}

export function parseArguments(argumentString: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuotes: false | string = false;
  let escapeNext = false;

  for (let i = 0; i < argumentString.length; i += 1) {
    const char = argumentString[i];

    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (char === "\"" || char === "'") {
      if (inQuotes === char) {
        inQuotes = false;
      } else if (!inQuotes) {
        inQuotes = char;
      } else {
        current += char;
      }
      continue;
    }

    if (!inQuotes && /\s/.test(char)) {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    args.push(current);
  }

  return args;
}
