import type { SearchEngineProvider } from "../core/provider.js";
import type { QueryEngineType } from "../core/types.js";
import { BingWebmasterProvider } from "./bing/provider.js";
import { GoogleSearchConsoleProvider } from "./google/provider.js";

/** Every query engine, keyed by its id. `providers[engine]` is never `undefined`. */
export const providers: Readonly<Record<QueryEngineType, SearchEngineProvider>> = {
  google: new GoogleSearchConsoleProvider(),
  bing: new BingWebmasterProvider(),
};
