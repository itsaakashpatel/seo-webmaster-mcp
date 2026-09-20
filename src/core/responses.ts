export function okText(text: string): {
  content: [{ type: "text"; text: string }];
} {
  return { content: [{ type: "text" as const, text }] };
}

export function errText(text: string): {
  isError: true;
  content: [{ type: "text"; text: string }];
} {
  return { isError: true as const, content: [{ type: "text" as const, text }] };
}
