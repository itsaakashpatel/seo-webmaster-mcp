# SEO & Webmaster MCP Server

[![MCP](https://img.shields.io/badge/Model%20Context%20Protocol-Compatible-blue.svg)](https://modelcontextprotocol.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A unified **Model Context Protocol (MCP)** server providing AI assistants (Claude Desktop, Claude Code, Cursor, Windsurf, Cline, Zed, etc.) with comprehensive, read-only search performance data and instant indexing across **Google Search Console**, **Google Indexing API**, **Bing Webmaster Tools**, and **IndexNow**.

---

## Why SEO Webmaster MCP?

Most search console tools are single-engine only. **SEO Webmaster MCP** unifies your search presence under a provider architecture:

- 🌐 **Cross-Engine Search Visibility** — Query organic performance (clicks, impressions, CTR, position) across Google and Bing with unified dimension breakdowns.
- ⚡ **Instant Indexing via IndexNow** — Instantly notify Bing, Yandex, Seznam, and Naver whenever URLs are published, updated, or removed.
- 🔍 **Google Indexing API** — Push up to 200 URLs/day to Google (`URL_UPDATED` / `URL_DELETED`). Only JobPosting or BroadcastEvent-in-VideoObject pages are eligible.
- 🔍 **In-Depth URL Inspection** — Check real-time indexing status, crawl info, canonical URL tags, mobile usability issues, and rich results schema validation.
- 🗺️ **Sitemap Health Monitoring** — Track sitemaps submitted across engines, check last crawl dates, and monitor indexed vs. submitted URLs.
- 🛡️ **Safe & Extensible** — Read-only search analytics scopes protect your properties from unintended changes, while IndexNow handles fast discovery. Google Indexing uses the separate `https://www.googleapis.com/auth/indexing` scope.

---

## Available Tools

| Tool | Description |
|---|---|
| `engine_status` | Check the connection and configuration status of Google, Bing, IndexNow, and Google Indexing API providers with actionable setup guides. |
| `list_sites` | List verified properties across Google Search Console and Bing Webmaster Tools with user roles/permissions. |
| `search_analytics` | Query clicks, impressions, CTR, and average position grouped by queries, pages, countries, devices, and dates. |
| `inspect_url` | Inspect a URL for live indexing status, crawl timestamp, canonical checks, mobile usability, and schema markup. |
| `list_sitemaps` | List submitted sitemaps, error/warning counts, and submitted vs indexed URL counts. |
| `get_sitemap` | Retrieve deep indexing statistics for a specific sitemap feed. |
| `submit_urls_indexnow` | Instantly submit up to 10,000 URLs to Bing and partner engines using the IndexNow protocol. |
| `submit_urls_google` | Notify Google via the Indexing API (max 200 URLs/call, ~200/day quota; JobPosting / BroadcastEvent pages only). |

<details>
<summary><strong>Detailed Parameter Reference</strong></summary>

### 1. <code>engine_status</code>
No parameters required.

### 2. <code>list_sites</code>
| Parameter | Type | Required | Description |
|---|---|---|---|
| `engine` | string | No | Filter by engine: `all`, `google`, or `bing` (default: `all`) |

### 3. <code>search_analytics</code>
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

### 4. <code>inspect_url</code>
| Parameter | Type | Required | Description |
|---|---|---|---|
| `siteUrl` | string | **Yes** | Site URL as verified in Search Console |
| `inspectionUrl` | string | **Yes** | Fully qualified URL to inspect |
| `engine` | string | No | `google` or `bing` (default: `google`) |
| `languageCode` | string | No | Language code for localized messages (e.g. `en-US`) |

### 5. <code>list_sitemaps</code>
| Parameter | Type | Required | Description |
|---|---|---|---|
| `siteUrl` | string | **Yes** | Site URL as verified in Search Console |
| `engine` | string | No | `google` or `bing` (default: `google`) |

### 6. <code>get_sitemap</code>
| Parameter | Type | Required | Description |
|---|---|---|---|
| `siteUrl` | string | **Yes** | Site URL as verified in Search Console |
| `feedpath` | string | **Yes** | Full URL or path to the sitemap feed |
| `engine` | string | No | `google` or `bing` (default: `google`) |

### 7. <code>submit_urls_indexnow</code>
| Parameter | Type | Required | Description |
|---|---|---|---|
| `host` | string | **Yes** | Domain name without protocol (e.g. `example.com`) |
| `urls` | string | **Yes** | Comma-separated or newline-separated list of full URLs (or JSON array) |
| `key` | string | No | IndexNow key (optional if `INDEXNOW_KEY` env var is set) |
| `keyLocation` | string | No | Full URL to key file if hosted in custom location |

### 8. <code>submit_urls_google</code>
| Parameter | Type | Required | Description |
|---|---|---|---|
| `urls` | string | **Yes** | Comma/newline-separated full https URLs (or JSON array). Max 200 per call |
| `type` | string | No | `URL_UPDATED` (new/changed) or `URL_DELETED` (removed). Default: `URL_UPDATED` |

> Google limits: only pages with JobPosting or BroadcastEvent-in-VideoObject structured data are eligible. Default quota is 200 publish requests/day. A 200 response means Google may recrawl soon; 429 means quota exhausted.

</details>

---

## Authentication & Setup

You can configure any or all of the supported engines:

### 1. Google Search Console

1. In the [Google Cloud Console](https://console.cloud.google.com/), create a project (or select an existing one).
2. Go to **APIs & Services** → **Library**, search for **Google Search Console API**, and click **Enable**.
3. Repeat step 2 for the **Indexing API** (`indexing.googleapis.com`) if you use `submit_urls_google`.
4. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **Service Account**.
5. Give it a name (e.g., `gsc-mcp-reader`) and complete the creation.
6. Click on the service account → **Keys** tab → **Add Key** → **Create new key** → **JSON**.
7. Save the downloaded JSON key file securely on your computer (e.g., `~/.config/gcloud/gsc-key.json`).
8. Copy the service account's email address (e.g. `gsc-mcp-reader@project.iam.gserviceaccount.com`).
9. In [Google Search Console](https://search.google.com/search-console), select your property → **Settings** → **Users and permissions** → **Add user**.
10. Paste the service account email and grant **Owner** (required for Indexing API) or at least **Full** permission. Verify ownership of every domain you submit via the Indexing API.
11. Note the Indexing API quota (default 200/day) under **APIs & Services** → **Quotas**; request more if needed. Only JobPosting / BroadcastEvent pages qualify.

### 2. Bing Webmaster Tools

1. Sign in to [Bing Webmaster Tools](https://www.bing.com/webmasters) and verify your site.
2. Click the **Settings** gear icon (top right) → **API Access** → **API Key**.
3. Generate an API Key and copy it.
4. Set `BING_WEBMASTER_API_KEY` in your configuration.

### 3. IndexNow (Instant Submission)

1. Generate an IndexNow key (e.g. at [Bing IndexNow](https://www.bing.com/indexnow)).
2. Place a file named `<your-key>.txt` containing only the key at your website root (`https://example.com/<your-key>.txt`).
3. Set `INDEXNOW_KEY` in your configuration.

---

## Client Configurations

### Claude Desktop

Edit your `claude_desktop_config.json`:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "seo-webmaster": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/seo-webmaster-mcp/build/index.js"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/gsc-key.json",
        "BING_WEBMASTER_API_KEY": "your_bing_api_key",
        "INDEXNOW_KEY": "your_indexnow_key"
      }
    }
  }
}
```

### Claude Code CLI

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "seo-webmaster": {
      "type": "stdio",
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/seo-webmaster-mcp/build/index.js"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/gsc-key.json",
        "BING_WEBMASTER_API_KEY": "your_bing_api_key",
        "INDEXNOW_KEY": "your_indexnow_key"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` or Cursor Settings → Features → MCP Servers:

```json
{
  "mcpServers": {
    "seo-webmaster": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/seo-webmaster-mcp/build/index.js"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/gsc-key.json",
        "BING_WEBMASTER_API_KEY": "your_bing_api_key",
        "INDEXNOW_KEY": "your_indexnow_key"
      }
    }
  }
}
```

---

## Example Agent Prompts

Once connected, ask your AI assistant naturally:

- *"Check search engine provider status."*
- *"List all my verified properties across Google and Bing."*
- *"Show me top 25 queries on Google for my site over the last 28 days."*
- *"Compare my top queries on Bing vs Google for https://example.com/."*
- *"Find striking distance keywords (ranking 5–15 with high impressions) on Google."*
- *"Inspect https://example.com/blog/my-article and check if there are any mobile or schema errors."*
- *"Check all submitted sitemaps for my site and report indexing health."*
- *"I just published 3 new blog posts. Submit them to IndexNow immediately."*
- *"Notify Google that 5 job postings changed via the Indexing API (URL_UPDATED)."* (max 200/day; JobPosting / BroadcastEvent pages only)
- *"Tell Google these 2 expired job URLs are deleted (URL_DELETED)."* 

---

## Local Development

```bash
# Clone the repository
git clone https://github.com/itsaakashpatel/seo-webmaster-mcp.git
cd seo-webmaster-mcp

# Install dependencies
npm install

# Compile TypeScript
npm run build

# Watch mode during development
npm run dev
```

---

## License

MIT © [Aakash Patel](https://github.com/itsaakashpatel)
