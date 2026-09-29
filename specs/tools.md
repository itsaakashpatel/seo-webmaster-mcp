# Tool Specifications

This document defines the specification and runtime contract for the eight Model Context Protocol (MCP) tools in this server. It describes tool inputs, validation rules, search engine behaviors, error responses, and operational limits. Any change to tool behavior must update this document before code implementation.

## Conventions

### Engine Parameter and Defaults
- The `engine` parameter specifies the target search engine.
- For single-engine tools, the allowed values are `"google"` and `"bing"`. The default value is `"google"`.
- For `list_sites`, the allowed values are `"all"`, `"google"`, and `"bing"`. The default value is `"all"`.

### Site URL Formats
- The `siteUrl` parameter must be a non-empty string after trimming. An empty or whitespace-only value is rejected with an invalid-params error.
- Provide the exact site property identifier as verified in the search engine.
- For URL-prefix properties, provide the full URL including protocol and trailing slash (for example, `https://example.com/`).
- For Google domain properties, provide the domain with the domain prefix (for example, `sc-domain:example.com`).

### Error Results and Prefixes
- When an operation fails, the tool returns an MCP tool result with `isError: true`.
- The error text starts with a fixed tool-specific prefix, a colon, and the failure description. Two results are exceptions: `list_sites` when all engines fail, and `submit_urls_google` when no URL succeeds. These return their full report as the error text.
- When an argument does not match the input schema, the server rejects the call with an MCP invalid-params protocol error (code `-32602`). The tool does not run.

### Dates
- Dates must use the `YYYY-MM-DD` format.
- Every date must represent a valid calendar date. Values such as `2026-02-30` are rejected.
- In date ranges, `startDate` must be less than or equal to `endDate`.

### Filter Grammar
Search analytics tools support a prefix-based filter grammar for `queryFilter` and `pageFilter`. The table below lists all prefixes in order of evaluation precedence:

| Prefix | Mode | Negate | Description |
| --- | --- | --- | --- |
| `!regex:` | regex | Yes | Does not match the RE2 regular expression |
| `regex:` | regex | No | Matches the RE2 regular expression |
| `!exact:` | equals | Yes | Does not equal the text |
| `!=` | equals | Yes | Does not equal the text |
| `exact:` | equals | No | Equals the text |
| `!` | contains | Yes | Does not contain the text |
| (none / plain text) | contains | No | Contains the text |

- The filter value after the prefix must not be empty.
- Text comparisons are case-insensitive.
- Regular expression patterns use RE2 syntax. RE2 executes in linear time and prevents catastrophic backtracking.
- Regular expression patterns must not exceed 200 characters.
- Google Search Console evaluates filters server-side.
- Bing Webmaster Tools evaluates filters client-side.

---

## engine_status

### Purpose
Check the configuration and connection status of all integrated search engine providers.

### Annotations
Read-only (`readOnlyHint: true`, `openWorldHint: true`).

### Inputs
| Name | Type | Required | Default | Rules |
| --- | --- | --- | --- | --- |
| (none) | - | - | - | Tool accepts no arguments. |

### Behavior
1. Check credentials for Google Search Console, Bing Webmaster Tools, IndexNow, and the Google Indexing API.
2. Probe Google Application Default Credentials with a 2-second timeout if explicit credentials are not set.
3. Return a Markdown table listing Provider name, Engine identifier, Connection status (`Connected` or `Not Configured`), and Auth Method.
4. For every provider that is not configured, append the full setup guide to the output.

### Errors
- Returns `Error checking engine status: <message>` if the status collection fails.

### Limits
- Google Application Default Credentials probe timeout: 2 seconds.
- HTTP request timeout: 15 seconds.

---

## list_sites

### Purpose
List all verified website properties across Google Search Console and Bing Webmaster Tools with user permission levels.

### Annotations
Read-only (`readOnlyHint: true`, `openWorldHint: true`).

### Inputs
| Name | Type | Required | Default | Rules |
| --- | --- | --- | --- | --- |
| `engine` | string | No | `"all"` | Must be `"all"`, `"google"`, or `"bing"`. |

### Behavior
1. Determine target engines: if `"all"`, query both Google Search Console and Bing Webmaster Tools; otherwise query the specified engine.
2. Execute requests to all target engines concurrently in parallel.
3. If one engine fails while another succeeds, return the successful properties and include a warning for the failed provider.
4. If all target engines fail, return an error result containing the error messages from all failed engines.
5. If all target engines succeed but have no verified properties, return a message indicating no sites were found.
6. Render verified properties in a Markdown table showing Engine, Site URL, and Permission / Role.

### Errors
- Returns `Failed to retrieve sites:` followed by the error of each engine, if all target engines fail.
- Rejects the call with an invalid-params error if `engine` is not `"all"`, `"google"`, or `"bing"`.

### Limits
- HTTP request timeout: 15 seconds per request.

---

## search_analytics

### Purpose
Query search performance metrics including clicks, impressions, click-through rate, and average position from Google Search Console or Bing Webmaster Tools.

### Annotations
Read-only (`readOnlyHint: true`, `openWorldHint: true`).

### Inputs
| Name | Type | Required | Default | Rules |
| --- | --- | --- | --- | --- |
| `siteUrl` | string | Yes | - | Must be non-empty. Exact verified property URL or domain property. |
| `startDate` | string | Yes | - | Valid calendar date in `YYYY-MM-DD` format. Must be on or before `endDate`. |
| `endDate` | string | Yes | - | Valid calendar date in `YYYY-MM-DD` format. Must be on or after `startDate`. |
| `engine` | string | No | `"google"` | Must be `"google"` or `"bing"`. |
| `dimensions` | string | No | `"query"` | Comma-separated list: `query`, `page`, `country`, `device`, `searchAppearance`, `date`. |
| `rowLimit` | number | No | `100` | Integer from 1 to 25000. Google caps at 25000; Bing caps at 5000. |
| `searchType` | string | No | `"web"` | Enum: `"web"`, `"image"`, `"video"`, `"news"`, `"discover"`, `"googleNews"`. |
| `dataState` | string | No | `"all"` | Enum: `"all"`, `"final"`. Supported by Google only. |
| `queryFilter` | string | No | - | Query filter expression using the filter grammar. Maximum 200 characters. |
| `pageFilter` | string | No | - | Page URL filter expression using the filter grammar. Maximum 200 characters. |
| `countryFilter` | string | No | - | ISO 3166-1 alpha-3 country code (3 letters, case-insensitive, for example `USA` or `GBR`). |
| `deviceFilter` | string | No | - | Enum: `"DESKTOP"`, `"MOBILE"`, `"TABLET"`. |
| `startRow` | number | No | `0` | Zero-based row offset for pagination. Minimum 0. |

### Behavior
1. Validate date strings for `YYYY-MM-DD` format, real calendar validity, and correct ordering (`startDate <= endDate`).
2. Parse and normalize dimensions. Drop unknown dimensions and duplicate entries. If no valid dimensions remain, default to `["query"]`.
3. Clamp `rowLimit` to a minimum of 1 and a maximum of 25000 for Google, or 5000 for Bing. Clamp `startRow` to a minimum of 0.
4. For Google Search Console:
   - Send dimensions, clamped limits, offset, search vertical, and data state to the Search Analytics API.
   - Build dimension filter groups for query, page, country, and device filters and apply them server-side.
   - Map country filter to uppercase 3-letter code. Reject invalid formats.
5. For Bing Webmaster Tools:
   - Resolve single-dimension mode: select `"page"` mode if `dimensions` includes `page` and not `query`, or if `pageFilter` is present without `queryFilter`; otherwise select `"query"` mode.
   - Request data from `GetPageStats` for page mode or `GetQueryStats` for query mode.
   - Filter rows client-side against the date range and the active text filter (`pageFilter` in page mode, `queryFilter` in query mode).
   - Aggregate weekly bucketed rows by key: calculate total clicks, total impressions, CTR (`clicks / impressions`), and impression-weighted average position.
   - Sort aggregated rows descending by clicks, then descending by impressions.
   - Slice rows using `startRow` and clamped `rowLimit`.
   - Append notes for unsupported parameters: ignored `countryFilter`, ignored `deviceFilter`, unsupported `searchType`, ignored `dataState`, unsupported multi-dimensional grouping, mismatching filter rules (query filter in page mode or page filter in query mode), and client-side weekly aggregation details.
6. Render a summary containing Total Clicks, Total Impressions, Average CTR, and Average Position, followed by a Markdown table of rows.
7. Return an empty result message if no rows match the query.

### Errors
- Returns `Error querying search analytics: Invalid date format. Use YYYY-MM-DD (got "<startDate>" to "<endDate>").`
- Returns `Error querying search analytics: Invalid calendar date "<date>".`
- Returns `Error querying search analytics: Invalid date range: startDate "<start>" is after endDate "<end>".`
- Returns `Error querying search analytics: Invalid countryFilter "<value>". Use ISO 3166-1 alpha-3 (e.g. USA, GBR).`
- Returns `Error querying search analytics: Invalid <label>: "<prefix>" needs a non-empty value.`
- Returns `Error querying search analytics: Invalid <label> regex: pattern exceeds 200 chars.`
- Returns `Error querying search analytics: Invalid <label> regex "<pattern>": <reason>` if the pattern is not valid RE2 syntax (for example, a backreference or a lookahead).
- Returns `Error querying search analytics: <message>` for provider authentication or API failures.

### Limits
- Maximum row limit: 25,000 rows for Google, 5,000 rows for Bing.
- Default row limit: 100 rows.
- Maximum filter pattern length: 200 characters.
- HTTP request timeout: 15 seconds.

---

## inspect_url

### Purpose
Inspect a specific URL to check indexing status, crawl details, canonical URLs, mobile usability, and rich results.

### Annotations
Read-only (`readOnlyHint: true`, `openWorldHint: true`).

### Inputs
| Name | Type | Required | Default | Rules |
| --- | --- | --- | --- | --- |
| `siteUrl` | string | Yes | - | Must be non-empty. Verified property URL. |
| `inspectionUrl` | string | Yes | - | Must be a valid HTTP or HTTPS URL belonging to `siteUrl`. |
| `engine` | string | No | `"google"` | Must be `"google"` or `"bing"`. |
| `languageCode` | string | No | `"en-US"` | Language code for issue messages (for example, `en-US`). |

### Behavior
1. Validate that `inspectionUrl` is a valid HTTP or HTTPS URL.
2. For Google Search Console:
   - Call the Google URL Inspection Index API.
   - Return overall verdict, coverage state, indexing state, last crawl time, crawled-as user agent, robots.txt state, page fetch state, user-declared canonical, and Google-selected canonical.
   - List referring URLs (up to 5) and associated sitemaps.
   - Return mobile usability verdict and detected usability issues with severity.
   - Return rich results verdict and detected schema items with issue messages.
3. For Bing Webmaster Tools:
   - Bing does not provide URL-level inspection.
   - Fetch property-level crawl stats from `GetCrawlStats`.
   - Return overall verdict `"UNKNOWN"`.
   - Set coverage state to indicate that URL-level inspection is unavailable and provide property-level context.
   - Return the newest site-level crawl date as `siteLastCrawlTime`.
   - Return empty arrays for referring URLs and sitemaps.
4. Render inspection details in Markdown sections.

### Errors
- Rejects the call with an invalid-params error if `inspectionUrl` is not a full HTTP or HTTPS URL.
- Returns `Error inspecting URL: No inspection result returned for "<inspectionUrl>"` if Google returns an empty payload.
- Returns `Error inspecting URL: <message>` for provider authentication, permission (403), or network failures.

### Limits
- Maximum displayed referring URLs: 5.
- HTTP request timeout: 15 seconds.

---

## list_sitemaps

### Purpose
List all submitted sitemaps and their current status, last download date, error counts, and URL counts for a site property.

### Annotations
Read-only (`readOnlyHint: true`, `openWorldHint: true`).

### Inputs
| Name | Type | Required | Default | Rules |
| --- | --- | --- | --- | --- |
| `siteUrl` | string | Yes | - | Must be non-empty. Verified property URL. |
| `engine` | string | No | `"google"` | Must be `"google"` or `"bing"`. |

### Behavior
1. For Google Search Console:
   - Fetch all submitted sitemaps via the Search Console Sitemaps API.
   - Return sitemap path, last submitted date, last downloaded date, sitemap type (`Sitemap Index` or `Standard Sitemap`), error count, warning count, and status (`Pending`, `Has errors`, or `Success`).
   - Include submitted and indexed URL counts categorized by content type.
2. For Bing Webmaster Tools:
   - Fetch feeds via the Bing `GetFeeds` endpoint.
   - Return sitemap URL, last submitted date, last crawled date, type, status, and total submitted URL count.
   - Bing sitemaps do not provide indexed URL counts, error counts, or warning counts. Leave these values empty.
3. Render a Markdown table of sitemaps and append breakdown lists for URL counts.
4. If no sitemaps are found, return a message stating that no sitemaps exist for the property.

### Errors
- Returns `Error listing sitemaps: <message>` for provider authentication or API failures.

### Limits
- HTTP request timeout: 15 seconds.

---

## get_sitemap

### Purpose
Retrieve deep indexing and error metrics for a specific sitemap feed.

### Annotations
Read-only (`readOnlyHint: true`, `openWorldHint: true`).

### Inputs
| Name | Type | Required | Default | Rules |
| --- | --- | --- | --- | --- |
| `siteUrl` | string | Yes | - | Must be non-empty. Verified property URL. |
| `feedpath` | string | Yes | - | Must be non-empty. Full URL or relative path to the sitemap feed. |
| `engine` | string | No | `"google"` | Must be `"google"` or `"bing"`. |

### Behavior
1. For Google Search Console:
   - Call the Google Sitemaps API for the exact `feedpath`.
   - Return path, provider name, sitemap type, status, last submitted, last downloaded, error count, warning count, and contents breakdown with submitted and indexed counts.
2. For Bing Webmaster Tools:
   - Call the Bing `GetFeeds` endpoint to list all site feeds.
   - Normalize feed paths by converting to lowercase and stripping protocols and trailing slashes.
   - Find the matching sitemap feed.
   - If no matching feed is found, throw an error.
   - Return matching feed details without indexed URL counts, error counts, or warning counts.
3. Render sitemap metadata and contents breakdown in Markdown format.

### Errors
- Returns `Error getting sitemap details: Sitemap feed "<feedpath>" not found in Bing Webmaster Tools for <siteUrl>` if the feed does not match any Bing feed.
- Returns `Error getting sitemap details: <message>` for provider authentication or API failures.

### Limits
- HTTP request timeout: 15 seconds.

---

## submit_urls_indexnow

### Purpose
Submit URLs to the IndexNow service to notify Bing, Yandex, Seznam, Naver, and other participating search engines of content changes.

### Annotations
Submit (not read-only, not destructive, idempotent; `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`).

### Inputs
| Name | Type | Required | Default | Rules |
| --- | --- | --- | --- | --- |
| `host` | string | Yes | - | Bare domain name of the site (for example, `example.com`). Protocol, port, and trailing slashes are removed. |
| `urls` | string | Yes | - | Comma-separated list, newline-separated list, JSON array of strings, or JSON object with a `urls` array. Maximum 10,000 URLs. |
| `key` | string | No | - | IndexNow API key. If omitted, reads from `INDEXNOW_KEY` environment variable. |
| `keyLocation` | string | No | - | Full HTTP or HTTPS URL to the key file if not hosted at the site root. If omitted, reads from `INDEXNOW_KEY_LOCATION` environment variable. |

### Behavior
1. Normalize `host`: strip protocol (`http://` or `https://`), path, port, and trailing dots, and convert to lowercase.
2. Read the IndexNow API key from the `key` parameter or the `INDEXNOW_KEY` environment variable. If neither exists, fail with the IndexNow setup guide.
3. Parse `urls` from JSON or delimited text.
4. Trim every URL, discard empty entries, and remove duplicates while maintaining first-seen order.
5. Validate that all submitted URLs are valid HTTP or HTTPS URLs and belong to the normalized `host`.
6. Validate that `keyLocation` is a valid HTTP or HTTPS URL if provided.
7. Enforce that the number of deduplicated URLs is between 1 and 10,000.
8. Send an HTTP POST request to `https://api.indexnow.org/indexnow` with a JSON payload containing `host`, `key`, `urlList`, and optional `keyLocation`.
9. Handle HTTP response status codes:
   - 200: URLs submitted and processed.
   - 202: URLs received; key validation will proceed asynchronously.
   - 400: Invalid format.
   - 403: Forbidden (key invalid or not hosted at expected location).
   - 422: Unprocessable entity (URLs do not belong to host or key mismatch).
   - 429: Rate limited.
10. Return a Markdown summary displaying Host, Submitted Count, Status Code, Status Message, and the first 10 submitted URLs.

### Errors
- Returns `IndexNow submission error: IndexNow is not configured...` if no key is provided or found in the environment.
- Returns `IndexNow submission error: Invalid host "<host>". Use a bare domain like "example.com".`
- Returns `IndexNow submission error: No valid URLs provided to submit.` if URL input is empty.
- Returns `IndexNow submission error: Too many URLs (<count>). IndexNow allows max 10000 per request.` if URL count exceeds 10,000.
- Returns `IndexNow submission error: <count> URL(s) do not belong to host "<host>" or use non-http(s) scheme...` if any URL host does not match.
- Returns `IndexNow submission error: Invalid keyLocation "<location>": must be a full http(s) URL.`
- Returns `IndexNow submission error: <status message>` for non-2xx HTTP responses.

### Limits
- Maximum URLs per submission: 10,000 URLs.
- Maximum submitted URLs displayed in output: 10 URLs.
- HTTP request timeout: 15 seconds.

---

## submit_urls_google

### Purpose
Notify Google about updated or deleted URLs via the Google Indexing API for eligible JobPosting or BroadcastEvent pages.

### Annotations
Submit with quota (not read-only, not destructive, not idempotent because each call uses daily quota; `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: true`).

### Inputs
| Name | Type | Required | Default | Rules |
| --- | --- | --- | --- | --- |
| `urls` | string | Yes | - | Comma-separated list, newline-separated list, JSON array of strings, or JSON object with a `urls` array. Maximum 200 URLs. |
| `type` | string | No | `"URL_UPDATED"` | Notification type. Must be `"URL_UPDATED"` or `"URL_DELETED"`. |

### Behavior
1. Parse `urls` from JSON or delimited text.
2. Trim every URL, drop empty entries, and remove duplicates while preserving first-seen order.
3. Enforce that the number of deduplicated URLs is between 1 and 200.
4. Validate that all URLs are valid HTTP or HTTPS URLs.
5. Check credentials from `GOOGLE_SERVICE_ACCOUNT_KEY` (or `GOOGLE_SERVICE_ACCOUNT_JSON`), `GOOGLE_APPLICATION_CREDENTIALS`, or Application Default Credentials. If none is available, fail with the Google Indexing setup guide.
6. Divide URLs into sequential batches of 5 URLs.
7. Execute requests in parallel within each batch of 5.
8. If any request returns HTTP 429 (Quota exceeded), mark all remaining URLs across all subsequent batches as skipped (status 429) without making network calls.
9. Collect per-URL results containing URL, notification type, success status, status code, response message, and notification timestamp if returned.
10. If zero URLs succeed, mark the overall tool response as an error (`isError: true`).
11. Render a Markdown summary with Notification Type, Submitted Count, Succeeded Count, Failed Count, eligibility reminders, quota reminders, and per-URL results for up to 20 URLs.

### Errors
- Returns `Google indexing error: Google Indexing API is not configured or not enabled...` if credentials are not configured.
- Returns `Google indexing error: No valid URLs provided to submit.` if the URL list is empty.
- Returns `Google indexing error: Too many URLs (<count>). Google Indexing API allows max 200 per call (default daily quota is 200). Split into smaller batches.` if URL count exceeds 200.
- Returns `Google indexing error: <count> URL(s) are not valid http(s) URLs...` if any URL is invalid.
- Returns `Google indexing error: Permission error (403): ... The Indexing API requires the service account email to be added as an 'Owner' of this property in Google Search Console.`
- Marks tool result as an error if all URL submissions fail.

### Limits
- Maximum URLs per call: 200 URLs.
- Batch concurrency: 5 parallel requests per batch.
- Default API daily quota: 200 publish requests per day.
- Maximum per-URL items displayed in output: 20 items.
- HTTP request timeout: 15 seconds per request.
