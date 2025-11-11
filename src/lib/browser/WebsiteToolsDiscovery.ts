import { Logging } from "@/lib/utils/Logging";
import { z } from "zod";


export const WebsiteToolParameterSchema = z.object({
    type: z.enum(['string', 'number', 'boolean', 'array', 'object']),  // Parameter type
    description: z.string(),  // Parameter description
    required: z.boolean(),  // Whether parameter is required
  });
  
export type WebsiteToolParameter = z.infer<typeof WebsiteToolParameterSchema>;

export const WebsiteToolSchema = z.object({
    name: z.string(),
    description: z.string(),
    eventName: z.string(),
    parameters: z.record(z.string(), WebsiteToolParameterSchema),
});

export type WebsiteTool = z.infer<typeof WebsiteToolSchema>;

export const RouteManifestSchema = z.object({
    pageId: z.string(),  // Unique identifier for the page
    title: z.string(),  // Human-readable page title
    description: z.string(),  // Description of page purpose
    manifestUrl: z.string(),  // URL to fetch tools manifest
    urlPatterns: z.array(z.string()).optional(),  // Optional URL patterns to match (e.g., ["/", "/home", "/index"])
})

export type RouteManifest = z.infer<typeof RouteManifestSchema>;

export const LLMTextSchema = z.object({
    version: z.string(),
    description: z.string().optional(),
    routes: z.array(RouteManifestSchema),
})

export type LLMText = z.infer<typeof LLMTextSchema>;

export const WebsiteToolsManifestSchema = z.object({
    version: z.string(),
    tools: z.array(WebsiteToolSchema),
})

export type WebsiteToolsManifest = z.infer<typeof WebsiteToolsManifestSchema>;

export class WebsiteToolsDiscovery {
    static async discoverTools(url: string): Promise<WebsiteTool[]> {
        try {
            Logging.log('WebsiteToolsDiscovery', `Discovering tools for ${url}`, 'info');
            const llmTxt = await this.discoverLLMText(url);
            if(llmTxt) {
                Logging.log('WebsiteToolsDiscovery', `Discovered LLM text: ${llmTxt.version}`, 'info');
                const tools = await this.discoverToolsWithLLM(url, llmTxt);
                if(tools.length > 0) {
                    Logging.log('WebsiteToolsDiscovery', `Discovered ${tools.length} tools with LLM`, 'info');
                    return tools;
                }
                Logging.log('WebsiteToolsDiscovery', 'No tools discovered', 'info');
                return [];
            }
            Logging.log('WebsiteToolsDiscovery', 'No LLM text discovered', 'info');
            return [];
        } catch (error) {
            Logging.log('WebsiteToolsDiscovery', `Error discovering tools: ${error instanceof Error ? error.message : String(error)}`, 'error');
            return [];
        }
    }

    private static async discoverLLMText(baseUrl: string): Promise<LLMText | null> {
        try {
            const url: string = new URL('/.well-known/llms.txt', baseUrl).href;
            Logging.log('WebsiteToolsDiscovery', `Fetching LLM text from ${url}`, 'info');
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if(!response.ok) {
                Logging.log('WebsiteToolsDiscovery', `Failed to fetch: ${response.status} ${response.statusText} from ${url}`, 'warning');
                return null;
            }

            // Warn about incorrect content type but continue parsing
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                Logging.log('WebsiteToolsDiscovery', `Warning: Content-Type is ${contentType}, expected application/json (continuing anyway)`, 'warning');
            }

            // Try to parse as JSON regardless of content type
            const data = await response.json();
            const parsed = LLMTextSchema.safeParse(data);
            
            if (!parsed.success) {
                Logging.log('WebsiteToolsDiscovery', `Failed to parse llms.txt: ${parsed.error.message}`, 'error');
                return null;
            }
            
            return parsed.data;
        } catch (error) {
            Logging.log('WebsiteToolsDiscovery', `Error discovering LLM text: ${error instanceof Error ? error.message : String(error)}`, 'error');
            return null;
        }
    }

    private static async discoverToolsWithLLM(currentUrl: string, llmTxt: LLMText): Promise<WebsiteTool[]> {
       try {
        
        const currentRoute: RouteManifest | null = this._getCurrentRoute(currentUrl, llmTxt);

        if(!currentRoute) {
            Logging.log('WebsiteToolsDiscovery', 'No current route found', 'warning');
            return [];
        }

        Logging.log('WebsiteToolsDiscovery', `Current route: ${currentRoute.title}`, 'info');

        const manifestUrl = new URL(currentRoute.manifestUrl, currentUrl);
        const tools = await this._fetchManifest(manifestUrl.href);
    
        return tools;

       } catch (error) {
        // Improved: Show actual error details for debugging
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        Logging.log('WebsiteToolsDiscovery', `Error discovering tools with LLM: ${errorMessage}${errorStack ? `\n${errorStack}` : ''}`, 'error');
        return [];
       }
    }

    private static _getCurrentRoute(currentUrl: string, llmTxt: LLMText): RouteManifest | null {
        const urlObj = new URL(currentUrl);
        const pathname = urlObj.pathname;
        const routes = llmTxt.routes;
        
        // First: Try matching by urlPatterns if provided
        for (const route of routes) {
            if (route.urlPatterns && route.urlPatterns.length > 0) {
                for (const pattern of route.urlPatterns) {
                    if (this._matchesPattern(pathname, pattern)) {
                        Logging.log('WebsiteToolsDiscovery', `Matched route ${route.pageId} by pattern: ${pattern}`, 'info');
                        return route;
                    }
                }
            }
        }
        
        // Second: Match by pageId in pathname
        for (const route of routes) {
            if (pathname.includes(route.pageId) || pathname === `/${route.pageId}`) {
                Logging.log('WebsiteToolsDiscovery', `Matched route ${route.pageId} by pageId`, 'info');
                return route;
            }
        }
        
        // Third: Handle homepage - match empty path or just "/"
        if (pathname === '/' || pathname === '') {
            const homeRoute = routes.find(r => 
                r.pageId === 'home' || 
                r.pageId === 'index' || 
                r.pageId === ''
            );
            if (homeRoute) {
                Logging.log('WebsiteToolsDiscovery', `Matched home route: ${homeRoute.pageId}`, 'info');
                return homeRoute;
            }
        }
        
        // Fallback: return first route as default
        if (routes.length > 0) {
            Logging.log('WebsiteToolsDiscovery', `No matching route for ${pathname}, using default: ${routes[0].pageId}`, 'info');
            return routes[0];
        }
        
        return null;
    }
    
    private static _matchesPattern(pathname: string, pattern: string): boolean {
        // Exact match
        if (pathname === pattern) {
            return true;
        }
        
        // Wildcard pattern - ends with *
        if (pattern.endsWith('*')) {
            const prefix = pattern.slice(0, -1);
            return pathname.startsWith(prefix);
        }
        
        // Wildcard pattern - starts with *
        if (pattern.startsWith('*')) {
            const suffix = pattern.slice(1);
            return pathname.endsWith(suffix);
        }
        
        return false;
    }

    private static async _fetchManifest(manifestUrl: string): Promise<WebsiteTool[]> {
        try {
            Logging.log('WebsiteToolsDiscovery', `Fetching manifest from ${manifestUrl}`, 'info');
            const response = await fetch(manifestUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if(!response.ok) {
                Logging.log('WebsiteToolsDiscovery', `Failed to fetch manifest: ${response.status} ${response.statusText} from ${manifestUrl}`, 'warning');
                return [];
            }

            // Warn about incorrect content type but continue parsing
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                Logging.log('WebsiteToolsDiscovery', `Warning: Manifest Content-Type is ${contentType}, expected application/json (continuing anyway)`, 'warning');
            }

            // Try to parse as JSON regardless of content type
            const data = await response.json();
            const parsed = WebsiteToolsManifestSchema.safeParse(data);
            
            if (!parsed.success) {
                Logging.log('WebsiteToolsDiscovery', `Failed to parse manifest: ${parsed.error.message}`, 'error');
                return [];
            }
            
            return parsed.data.tools;
        } catch (error) {
            Logging.log('WebsiteToolsDiscovery', `Error fetching manifest: ${error instanceof Error ? error.message : String(error)}`, 'error');
            return [];
        }
    }
}
