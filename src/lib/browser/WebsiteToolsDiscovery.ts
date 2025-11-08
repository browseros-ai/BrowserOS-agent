import { Logging } from "@/lib/utils/Logging";

export interface WebsiteTool {
    name: string;
    description: string;
    eventName: string;
    parameters: Record<string, {
        type: 'string' | 'number' | 'boolean' | 'array' | 'object';
        description: string;
        required: boolean;
    }>
}

export interface WebsiteToolsManifest {
    version?: string;
    tools?: WebsiteTool[];
}

export class WebsiteToolsDiscovery {
    static async discoverTools(url: string): Promise<WebsiteTool[]> {
        try {
            Logging.log('WebsiteToolsDiscovery', `Discovering tools for ${url}`, 'info');
            const llmTxtTools = await this.discoverToolsWithLLM(url);
            if(llmTxtTools.length > 0) {
                Logging.log('WebsiteToolsDiscovery', `Discovered ${llmTxtTools.length} tools with LLM`, 'info');
                return llmTxtTools;
            }

            Logging.log('WebsiteToolsDiscovery', 'No tools discovered', 'info');
            return [];
        } catch (error) {
            Logging.log('WebsiteToolsDiscovery', `Error discovering tools: ${error instanceof Error ? error.message : String(error)}`, 'error');
            return [];
        }
    }

    private static async discoverToolsWithLLM(baseUrl: string): Promise<WebsiteTool[]> {
       try {
        // Fixed: Correct path with leading slash and dot
        const url = new URL('/.well-known/llms.txt', baseUrl);
        Logging.log('WebsiteToolsDiscovery', `Fetching LLM tools from ${url.href}`, 'info');
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if(!response.ok) {
            // Improved: Log the actual status with details
            Logging.log('WebsiteToolsDiscovery', `Failed to fetch: ${response.status} ${response.statusText} from ${url.href}`, 'warning');
            return []; // Return empty array instead of throwing
        }

        // Improved: Better JSON parsing with error handling
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            Logging.log('WebsiteToolsDiscovery', `Warning: Content-Type is ${contentType}, expected application/json`, 'warning');
        }

        const data = await response.json();
        
        // Improved: Handle both array and manifest formats
        if (Array.isArray(data)) {
            Logging.log('WebsiteToolsDiscovery', `Found ${data.length} tools (array format)`, 'info');
            return data;
        } else if (data.tools && Array.isArray(data.tools)) {
            // Manifest format with tools array
            Logging.log('WebsiteToolsDiscovery', `Found ${data.tools.length} tools (manifest format)`, 'info');
            return data.tools;
        } else {
            Logging.log('WebsiteToolsDiscovery', `Invalid format: expected array or {tools: []}, got ${JSON.stringify(data).substring(0, 100)}`, 'warning');
            return [];
        }

       } catch (error) {
        // Improved: Show actual error details for debugging
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        Logging.log('WebsiteToolsDiscovery', `Error discovering tools with LLM: ${errorMessage}${errorStack ? `\n${errorStack}` : ''}`, 'error');
        return [];
       }
    }
}
