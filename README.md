# seo-webmaster-mcp

[![MCP](https://img.shields.io/badge/Model%20Context%20Protocol-Compatible-blue.svg)](https://modelcontextprotocol.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A unified **Model Context Protocol (MCP)** server providing AI assistants (**Claude Desktop**, **Claude Code**, **Cursor**, **Windsurf**, **Cline**, **Zed**, etc.) with comprehensive organic search analytics, URL inspection, sitemap health monitoring, and instant search engine indexing across **Google Search Console**, **Google Indexing API**, **Bing Webmaster Tools**, and **IndexNow**.

---

## 🚀 Quickstart (Running in 2 Minutes)

You do **not** need to configure all engines. **All engines are completely optional!**
- If you only have Google Search Console, only configure Google.
- If you only have Bing Webmaster Tools, only configure Bing.
- If you want instant indexing without API keys, you can use IndexNow.
- If you configure nothing, start the server and ask your AI: *"Check engine status"* to see step-by-step setup guides!

### Option A: Run via `npx` (Recommended)

No cloning required. Your MCP client will download and run the latest version automatically.

#### 1. Claude Desktop
Add to your `claude_desktop_config.json`:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "seo-webmaster": {
      "command": "npx",
      "args": ["-y", "@itsaakashpatel/seo-webmaster-mcp"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/your/gsc-key.json",
        "BING_WEBMASTER_API_KEY": "your_bing_api_key",
        "INDEXNOW_KEY": "your_indexnow_key"
      }
    }
  }
}
```

#### 2. Cursor
Add to `.cursor/mcp.json` (project-level) or **Cursor Settings → Features → MCP Servers**:

```json
{
  "mcpServers": {
    "seo-webmaster": {
      "command": "npx",
      "args": ["-y", "@itsaakashpatel/seo-webmaster-mcp"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/your/gsc-key.json",
        "BING_WEBMASTER_API_KEY": "your_bing_api_key",
        "INDEXNOW_KEY": "your_indexnow_key"
      }
    }
  }
}
```

#### 3. Claude Code CLI
Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "seo-webmaster": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@itsaakashpatel/seo-webmaster-mcp"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/your/gsc-key.json",
        "BING_WEBMASTER_API_KEY": "your_bing_api_key",
        "INDEXNOW_KEY": "your_indexnow_key"
      }
    }
  }
}
```

---

## 🛠️ Step-by-Step Setup Guide

### 1. Google Search Console & Google Indexing API

> [!TIP]
> Both Search Console and Indexing API use the **exact same** service account credentials.

1. **Create a Cloud Project**: Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project (e.g. `my-seo-tools`).
2. **Enable APIs**:
   - In **APIs & Services → Library**, search for **Google Search Console API** and click **Enable**.
   - *(Optional for instant Google push)* Search for **Indexing API** (`indexing.googleapis.com`) and click **Enable**.
3. **Create Service Account**:
   - Go to **APIs & Services → Credentials → Create Credentials → Service Account**.
   - Name it (e.g. `gsc-reader`), click **Create and Continue**, then **Done**.
4. **Generate JSON Key File**:
   - Click on the created service account email.
   - Go to the **Keys** tab → **Add Key → Create new key → JSON**.
   - Save the downloaded file somewhere safe on your computer (e.g., `~/.config/gcloud/gsc-key.json`).
5. **Grant Property Access in Search Console**:
   - Copy the service account's email address (e.g. `gsc-reader@my-seo-tools.iam.gserviceaccount.com`).
   - Open [Google Search Console](https://search.google.com/search-console).
   - Select your property → **Settings** (bottom left) → **Users and permissions** → **Add user**.
   - Paste the service account email:
     - For read-only search analytics: select **Restricted** or **Full**.
     - If using Google Indexing API: select **Owner** (required by Google to publish indexing requests).
6. **Set Environment Variable**:
   - Set `GOOGLE_APPLICATION_CREDENTIALS` to the absolute path of your downloaded JSON file.
   - Alternatively, you can paste the raw JSON string or base64 into `GOOGLE_SERVICE_ACCOUNT_KEY`.

---

### 2. Bing Webmaster Tools

1. Sign in to [Bing Webmaster Tools](https://www.bing.com/webmasters) and ensure your site is verified.
2. Click the **Settings** gear icon (top right) → **API Access** → **API Key**.
3. Generate an API Key and copy it.
4. Set the `BING_WEBMASTER_API_KEY` environment variable in your MCP configuration.

---

### 3. IndexNow (Instant Indexing to Bing, Yandex, Seznam, Naver)

IndexNow allows search engines to instantly discover updated, new, or deleted URLs without waiting for crawlers.

1. **Generate a Key**: Create a random 32-character hexadecimal key (or use [Bing's Key Generator](https://www.bing.com/indexnow)).
2. **Host the Verification File**:
   - Place a text file named `<your-key>.txt` containing only the key at your website root:
     `https://example.com/<your-key>.txt`
   - Confirm it opens in your browser and displays only the key string.
3. **Set Environment Variable**:
   - Set `INDEXNOW_KEY` to your key string.
   - *(Optional)* If your key file is hosted in a subfolder or custom URL, set `INDEXNOW_KEY_LOCATION` to the full URL (e.g. `https://example.com/assets/my-key.txt`).

---

## 🧰 Available MCP Tools

| Tool | Engine | Description |
|---|:---:|---|
| [`engine_status`](#1-engine_status) | All | Check connection and configuration health across all 4 search engine providers with setup tips. |
| [`list_sites`](#2-list_sites) | Google & Bing | List all verified website properties with user permissions/roles. |
| [`search_analytics`](#3-search_analytics) | Google & Bing | Query clicks, impressions, CTR, and average position grouped by query, page, country, device, and date. |
| [`inspect_url`](#4-inspect_url) | Google & Bing | Inspect live URL index status, crawl dates, canonical tags, mobile usability, and rich results schema. |
| [`list_sitemaps`](#5-list_sitemaps) | Google & Bing | List submitted sitemaps, error/warning counts, crawl timestamps, and indexed URL breakdown. |
| [`get_sitemap`](#6-get_sitemap) | Google & Bing | Retrieve deep indexing statistics for a specific sitemap feed. |
| [`submit_urls_indexnow`](#7-submit_urls_indexnow) | IndexNow | Instantly notify Bing, Yandex, and partner engines about up to 10,000 published/updated/deleted URLs. |
| [`submit_urls_google`](#8-submit_urls_google) | Google Indexing | Push up to 200 URLs/day to Google via the Indexing API (`URL_UPDATED` or `URL_DELETED`). |

<details>
<summary><strong>Detailed Parameter Reference</strong></summary>

### 1. `engine_status`
No parameters required.

### 2. `list_sites`
| Parameter | Type | Required | Description |
|---|---|---|---|
| `engine` | string | No | Filter by engine: `all`, `google`, or `bing` (default: `all`) |

### 3. `search_analytics`
| Parameter | Type | Required | Description |
|---|---|---|---|
| `siteUrl` | string | **Yes** | Site URL as verified in Search Console (e.g. `https://example.com/` or `sc-domain:example.com`) |
| `startDate` | string | **Yes** | Start date in `YYYY-MM-DD` format |
| `endDate` | string | **Yes** | End date in `YYYY-MM-DD` format |
| `engine` | string | No | Provider: `google` or `bing` (default: `google`) |
| `dimensions` | string | No | Comma-separated: `query`, `page`, `country`, `device`, `searchAppearance`, `date` (default: `query`) |
| `rowLimit` | number | No | Max rows to return (default: `100`, max: `25000`) |
| `searchType` | string | No | Vertical: `web`, `image`, `video`, `news`, `discover`, `googleNews` (default: `web`) |
| `dataState` | string | No | `all` (includes fresh data) or `final` (default: `all`) |
| `queryFilter` | string | No | Filter queries: `substring`, `exact:keyword`, `regex:pattern`, or `!regex:pattern` |
| `pageFilter` | string | No | Filter page URLs: `substring`, `exact:url`, `regex:pattern`, or `!regex:pattern` |
| `countryFilter` | string | No | ISO 3166-1 alpha-3 code (e.g. `USA`, `GBR`, `DEU`, `IND`) |
| `deviceFilter` | string | No | `DESKTOP`, `MOBILE`, or `TABLET` |
| `startRow` | number | No | Pagination row offset (default: `0`) |

### 4. `inspect_url`
| Parameter | Type | Required | Description |
|---|---|---|---|
| `siteUrl` | string | **Yes** | Site URL as verified in Search Console |
| `inspectionUrl` | string | **Yes** | Fully qualified URL to inspect |
| `engine` | string | No | `google` or `bing` (default: `google`) |
| `languageCode` | string | No | Language code for localized messages (default: `en-US`) |

### 5. `list_sitemaps`
| Parameter | Type | Required | Description |
|---|---|---|---|
| `siteUrl` | string | **Yes** | Site URL as verified in Search Console |
| `engine` | string | No | `google` or `bing` (default: `google`) |

### 6. `get_sitemap`
| Parameter | Type | Required | Description |
|---|---|---|---|
| `siteUrl` | string | **Yes** | Site URL as verified in Search Console |
| `feedpath` | string | **Yes** | Full URL or path to the sitemap feed |
| `engine` | string | No | `google` or `bing` (default: `google`) |

### 7. `submit_urls_indexnow`
| Parameter | Type | Required | Description |
|---|---|---|---|
| `host` | string | **Yes** | Domain name without protocol (e.g. `example.com`) |
| `urls` | string | **Yes** | Comma/newline-separated list of full URLs (or JSON array) |
| `key` | string | No | IndexNow key (optional if `INDEXNOW_KEY` env var is set) |
| `keyLocation` | string | No | Full URL to key file if hosted in custom location |

### 8. `submit_urls_google`
| Parameter | Type | Required | Description |
|---|---|---|---|
| `urls` | string | **Yes** | Comma/newline-separated full https URLs (or JSON array). Max 200 per call |
| `type` | string | No | `URL_UPDATED` (new/changed) or `URL_DELETED` (removed). Default: `URL_UPDATED` |

> **Google Indexing API note**: Only pages containing `JobPosting` or `BroadcastEvent` (in `VideoObject`) structured data are supported by Google. Default daily quota is 200 requests.

</details>

---

## 💬 Example AI Assistant Prompts

Once configured in Claude or Cursor, you can interact with your search data in plain English:

- *"Check search engine provider status to see what is connected."*
- *"List all my verified websites across Google and Bing."*
- *"Show me the top 20 queries for my site on Google over the last 28 days."*
- *"Find pages that get high impressions but low click-through rates (CTR < 2%)."*
- *"Inspect https://example.com/blog/latest-post and tell me if it has any schema errors or mobile usability issues."*
- *"Check all submitted sitemaps for my site and report indexing health."*
- *"I just published 5 new blog posts: [URL list]. Submit them to IndexNow immediately."*
- *"Notify Google that these 2 job postings were updated via the Indexing API."*

---

## ❓ Troubleshooting & FAQs

### 1. `Permission error (403): User does not have sufficient permission`
- **Cause:** The service account has not been added as a user to your property in Google Search Console.
- **Fix:** In Google Search Console, go to **Settings → Users and permissions → Add user** and paste the exact email of your service account.

### 2. `Site URL not found`
- **Cause:** Search Console differentiates between domain properties (`sc-domain:example.com`) and URL prefix properties (`https://example.com/`).
- **Fix:** Run the `list_sites` tool first to view the exact property string format for your website.

### 3. `Bing Webmaster API authentication failed (401)`
- **Cause:** Missing or invalid `BING_WEBMASTER_API_KEY`.
- **Fix:** Re-generate your API key in Bing Webmaster Tools (Settings → API Access → API Key) and ensure there are no leading/trailing spaces in your config.

### 4. `Bing URL inspection returns UNKNOWN`
- **Explanation:** Unlike Google, the Bing Webmaster Tools API does not offer URL-level live inspection. The server returns coarse crawl stats if available, and transparently marks inspection verdict as `UNKNOWN` rather than fabricating data.

---

## 💻 Local Development & Contributing

Contributions are welcome! Please ensure all pull requests follow the project standards.

```bash
# Clone the repository
git clone https://github.com/itsaakashpatel/seo-webmaster-mcp.git
cd seo-webmaster-mcp

# Install dependencies
npm install

# Compile TypeScript
npm run build

# Run unit tests
npm test

# Run linter (oxlint)
npm run lint

# Check code formatting (oxfmt)
npm run format:check
```

### Pull Requests
When opening a pull request, please use the template located at [`.github/pull_request_template.md`](.github/pull_request_template.md) and adhere to the guidelines in [`AGENTS.md`](AGENTS.md).

---

## 📄 License

MIT © [Aakash Patel](https://github.com/itsaakashpatel)
