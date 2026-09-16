export function isBingConfigured(): boolean {
  return Boolean(
    process.env.BING_WEBMASTER_API_KEY &&
      process.env.BING_WEBMASTER_API_KEY.trim().length > 0
  );
}

export function getBingApiKey(): string {
  const key = process.env.BING_WEBMASTER_API_KEY?.trim();
  if (!key) {
    throw new Error(getBingConfigurationGuide());
  }
  return key;
}

export function getBingConfigurationGuide(): string {
  return (
    "Bing Webmaster Tools is not configured.\n\n" +
    "To configure:\n" +
    "1. Sign in to Bing Webmaster Tools (https://www.bing.com/webmasters).\n" +
    "2. Navigate to Settings (top right gear icon) → API Access → API Key.\n" +
    "3. Generate an API Key and copy it.\n" +
    "4. Set the `BING_WEBMASTER_API_KEY` environment variable in your MCP client configuration.\n" +
    "5. Ensure your site is added and verified in Bing Webmaster Tools."
  );
}

export function formatBingError(error: any): string {
  const msg = error?.message || String(error);
  if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("Invalid API Key")) {
    return (
      `Bing Webmaster API authentication failed (Invalid API Key).\n\n` +
      "Please verify your `BING_WEBMASTER_API_KEY` in Bing Webmaster Tools Settings → API Access."
    );
  }
  if (msg.includes("403") || msg.includes("Forbidden")) {
    return (
      `Bing Webmaster permission denied.\n\n` +
      "Ensure your Bing account has verified ownership of the requested site property."
    );
  }
  return msg;
}
