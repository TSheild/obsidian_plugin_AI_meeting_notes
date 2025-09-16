export function formatTemplate(template: string, values: Record<string, string | number | undefined | null>): string {
  return template.replace(/{{\s*([\w.-]+)\s*}}/g, (match, key) => {
    const value = values[key];
    if (value === undefined || value === null) {
      return "";
    }
    return String(value);
  });
}
