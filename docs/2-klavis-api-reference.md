----------- WEB PAGE -----------

TITLE: Create Server Instance - Klavis AI

URL: https://docs.klavis.ai/api-reference/mcp-server/create-a-server-instance

CONTENT:

Klavis AI home page Search... ⌘ K Ask AI

Dashboard

Klavis-AI / klavis 3,940

Documentation

API Reference

Knowledge Base

API References

Introduction

Manage MCP Server

POST Create Server Instance

POST Create Unified MCP Server Instance

GET Get Server Instance

DEL Delete Server Instance

MCP Server Metadata

GET Get All Servers

GET Get Tools

Function Calling with MCP

POST List Tools

POST Call Tool

User

GET Get User Instances

DEL Delete User

White Labeling

POST Create White Label

GET Get White Label

Auth / OAuth

POST Get OAuth URL

POST Set Auth Token

GET Get Authentication Metadata

DEL Delete Auth data for Server Instance

GitHub OAuth

Slack OAuth

Jira OAuth

Notion OAuth

Supabase OAuth

WordPress OAuth

Gmail OAuth

Google Calendar OAuth

Google Drive OAuth

Google Docs OAuth

Google Sheets OAuth

Airtable OAuth

Asana OAuth

Close OAuth

Confluence OAuth

Salesforce OAuth

Linear OAuth

Linkedin OAuth

Attio OAuth

Canva OAuth

Xero OAuth

Dropbox OAuth

QuickBooks OAuth

Create Server Instance

cURL

curl --request POST \ 
 --url https://api.klavis.ai/mcp-server/instance/create \ 
 --header 'Authorization: Bearer <token>' \ 
 --header 'Content-Type: application/json' \ 
 --data '{ 
 "serverName": "Affinity", 
 "userId": "<string>", 
 "platformName": "<string>", 
 "connectionType": "StreamableHttp" 
}' 200 422 { 
 "serverUrl" : "<string>" , 
 "instanceId" : "<string>" , 
 "oauthUrl" : "<string>" 
} Manage MCP Server

Create Server Instance

Creates a URL for a specified MCP server, validating the request with an API key and user details. Returns the existing server URL if it already exists for the user. If OAuth is configured for the server, also returns the base OAuth authorization URL.

POST / mcp-server / instance / create Try it

Authorizations

​ Authorization string header required

Your Klavis AI API key.

Body

application/json ​ serverName enum<string> required

The name of the target MCP server. Case-insensitive (e.g., 'google calendar', 'GOOGLE_CALENDAR', 'Google Calendar' are all valid).

Available options: Affinity , Airtable , Asana , Attio , Brave Search , ClickUp , Close , Confluence , Discord , Doc2markdown , Firecrawl Deep Research , Firecrawl Web Search , GitHub , Gmail , Gong , Google Calendar , Google Docs , Google Drive , Google Sheets , HubSpot , Jira , Klavis ReportGen , Linear , LinkedIn , Markdown2doc , Motion , Notion , Plai , Postgres , QuickBooks , Resend , Salesforce , Slack , Supabase , WhatsApp , WordPress , YouTube ​ userId string required

The identifier for the user requesting the server URL.

Minimum length: 1 ​ platformName string required

The name of the platform associated with the user.

Minimum length: 1 ​ connectionType enum<string>

The connection type to use for the MCP server. Default is STREAMABLE_HTTP.

Available options: SSE , StreamableHttp 

Response

200 application/json

Successful Response

​ serverUrl string required

The full URL for connecting to the MCP server, including the instance ID.

​ instanceId string required

The unique identifier for this specific server connection instance.

​ oauthUrl string | null

The OAuth authorization URL for the specified server, if OAuth is configured.

Introduction Create Unified MCP Server Instance github linkedin discord Powered by Mintlify ------------------------------------





||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

----------- WEB PAGE -----------

TITLE: Get Server Instance - Klavis AI

URL: https://docs.klavis.ai/api-reference/mcp-server/get-server-instance

CONTENT:

Klavis AI home page Search... ⌘ K Ask AI

Dashboard

Klavis-AI / klavis 3,940

Documentation

API Reference

Knowledge Base

API References

Introduction

Manage MCP Server

POST Create Server Instance

POST Create Unified MCP Server Instance

GET Get Server Instance

DEL Delete Server Instance

MCP Server Metadata

GET Get All Servers

GET Get Tools

Function Calling with MCP

POST List Tools

POST Call Tool

User

GET Get User Instances

DEL Delete User

White Labeling

POST Create White Label

GET Get White Label

Auth / OAuth

POST Get OAuth URL

POST Set Auth Token

GET Get Authentication Metadata

DEL Delete Auth data for Server Instance

GitHub OAuth

Slack OAuth

Jira OAuth

Notion OAuth

Supabase OAuth

WordPress OAuth

Gmail OAuth

Google Calendar OAuth

Google Drive OAuth

Google Docs OAuth

Google Sheets OAuth

Airtable OAuth

Asana OAuth

Close OAuth

Confluence OAuth

Salesforce OAuth

Linear OAuth

Linkedin OAuth

Attio OAuth

Canva OAuth

Xero OAuth

Dropbox OAuth

QuickBooks OAuth

Get Server Instance

cURL

curl --request GET \ 
 --url https://api.klavis.ai/mcp-server/instance/get/{instance_id} \ 
 --header 'Authorization: Bearer <token>' 200 422 { 
 "instanceId" : "<string>" , 
 "authNeeded" : false , 
 "isAuthenticated" : false , 
 "serverName" : "" , 
 "platform" : "" , 
 "externalUserId" : "" 
} Manage MCP Server

Get Server Instance

Checks the details of a specific server connection instance using its unique ID and API key, returning server details like authentication status and associated server/platform info.

GET / mcp-server / instance / get / {instance_id} Try it

Authorizations

​ Authorization string header required

Your Klavis AI API key.

Path Parameters

​ instance_id string<uuid> required

The ID of the connection instance whose status is being checked. This is returned by the Create API.

Response

200 application/json

Successful Response

​ instanceId string | null

The unique identifier of the connection instance.

​ authNeeded boolean default: false

Indicates whether authentication is required for this server instance.

​ isAuthenticated boolean default: false

Indicates whether the instance is authenticated successfully.

​ serverName string default: ""

The name of the MCP server associated with the instance.

​ platform string default: ""

The platform associated with the instance.

​ externalUserId string default: ""

The user's identifier on the external platform.

Create Unified MCP Server Instance Delete Server Instance github linkedin discord Powered by Mintlify Get Server Instance - Klavis AI ------------------------------------




||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

----------- WEB PAGE -----------

TITLE: Delete Server Instance - Klavis AI

URL: https://docs.klavis.ai/api-reference/mcp-server/delete-a-server-instance

CONTENT:

Klavis AI home page Search... ⌘ K Ask AI

Dashboard

Klavis-AI / klavis 3,940

Documentation

API Reference

Knowledge Base

API References

Introduction

Manage MCP Server

POST Create Server Instance

POST Create Unified MCP Server Instance

GET Get Server Instance

DEL Delete Server Instance

MCP Server Metadata

GET Get All Servers

GET Get Tools

Function Calling with MCP

POST List Tools

POST Call Tool

User

GET Get User Instances

DEL Delete User

White Labeling

POST Create White Label

GET Get White Label

Auth / OAuth

POST Get OAuth URL

POST Set Auth Token

GET Get Authentication Metadata

DEL Delete Auth data for Server Instance

GitHub OAuth

Slack OAuth

Jira OAuth

Notion OAuth

Supabase OAuth

WordPress OAuth

Gmail OAuth

Google Calendar OAuth

Google Drive OAuth

Google Docs OAuth

Google Sheets OAuth

Airtable OAuth

Asana OAuth

Close OAuth

Confluence OAuth

Salesforce OAuth

Linear OAuth

Linkedin OAuth

Attio OAuth

Canva OAuth

Xero OAuth

Dropbox OAuth

QuickBooks OAuth

Delete Server Instance

cURL

curl --request DELETE \ 
 --url https://api.klavis.ai/mcp-server/instance/delete/{instance_id} \ 
 --header 'Authorization: Bearer <token>' 200 422 { 
 "success" : true , 
 "message" : "<string>" 
} Manage MCP Server

Delete Server Instance

Completely removes a server connection instance using its unique ID, deleting all associated data from the system.

DELETE / mcp-server / instance / delete / {instance_id} Try it

Authorizations

​ Authorization string header required

Your Klavis AI API key.

Path Parameters

​ instance_id string<uuid> required

The ID of the connection instance to delete.

Response

200 application/json

Successful Response

​ success boolean required ​ message string | null Get Server Instance Get All Servers github linkedin discord Powered by Mintlify Delete Server Instance - Klavis AI ------------------------------------

||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
----------- WEB PAGE -----------

TITLE: Get All Servers - Klavis AI

URL: https://docs.klavis.ai/api-reference/mcp-server/get-all-servers

CONTENT:

Klavis AI home page Search... ⌘ K Ask AI

Dashboard

Klavis-AI / klavis 3,940

Documentation

API Reference

Knowledge Base

API References

Introduction

Manage MCP Server

POST Create Server Instance

POST Create Unified MCP Server Instance

GET Get Server Instance

DEL Delete Server Instance

MCP Server Metadata

GET Get All Servers

GET Get Tools

Function Calling with MCP

POST List Tools

POST Call Tool

User

GET Get User Instances

DEL Delete User

White Labeling

POST Create White Label

GET Get White Label

Auth / OAuth

POST Get OAuth URL

POST Set Auth Token

GET Get Authentication Metadata

DEL Delete Auth data for Server Instance

GitHub OAuth

Slack OAuth

Jira OAuth

Notion OAuth

Supabase OAuth

WordPress OAuth

Gmail OAuth

Google Calendar OAuth

Google Drive OAuth

Google Docs OAuth

Google Sheets OAuth

Airtable OAuth

Asana OAuth

Close OAuth

Confluence OAuth

Salesforce OAuth

Linear OAuth

Linkedin OAuth

Attio OAuth

Canva OAuth

Xero OAuth

Dropbox OAuth

QuickBooks OAuth

Get All Servers

cURL

curl --request GET \ 
 --url https://api.klavis.ai/mcp-server/servers \ 
 --header 'Authorization: Bearer <token>' 200 { 
 "servers" : [ 
 { 
 "id" : "3c90c3cc-0d44-4b50-8888-8dd25736052a" , 
 "name" : "<string>" , 
 "description" : "<string>" , 
 "tools" : [ 
 { 
 "name" : "<string>" , 
 "description" : "<string>" 
 } 
 ], 
 "authNeeded" : true 
 } 
 ] 
} MCP Server Metadata

Get All Servers

Get all MCP servers with their basic information including id, name, description, and tools.

GET / mcp-server / servers Try it

Authorizations

​ Authorization string header required

Your Klavis AI API key.

Response

200 - application/json

Successful Response

​ servers McpServer · object[] required

Show child attributes

Delete Server Instance Get Tools github linkedin discord Powered by Mintlify Get All Servers - Klavis AI ------------------------------------

||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
----------- WEB PAGE -----------

TITLE: Get Tools - Klavis AI

URL: https://docs.klavis.ai/api-reference/mcp-server/get-tools

CONTENT:

Klavis AI home page Search... ⌘ K Ask AI

Dashboard

Klavis-AI / klavis 3,940

Documentation

API Reference

Knowledge Base

API References

Introduction

Manage MCP Server

POST Create Server Instance

POST Create Unified MCP Server Instance

GET Get Server Instance

DEL Delete Server Instance

MCP Server Metadata

GET Get All Servers

GET Get Tools

Function Calling with MCP

POST List Tools

POST Call Tool

User

GET Get User Instances

DEL Delete User

White Labeling

POST Create White Label

GET Get White Label

Auth / OAuth

POST Get OAuth URL

POST Set Auth Token

GET Get Authentication Metadata

DEL Delete Auth data for Server Instance

GitHub OAuth

Slack OAuth

Jira OAuth

Notion OAuth

Supabase OAuth

WordPress OAuth

Gmail OAuth

Google Calendar OAuth

Google Drive OAuth

Google Docs OAuth

Google Sheets OAuth

Airtable OAuth

Asana OAuth

Close OAuth

Confluence OAuth

Salesforce OAuth

Linear OAuth

Linkedin OAuth

Attio OAuth

Canva OAuth

Xero OAuth

Dropbox OAuth

QuickBooks OAuth

Get Tools

cURL

curl --request GET \ 
 --url https://api.klavis.ai/mcp-server/tools/{server_name} \ 
 --header 'Authorization: Bearer <token>' 200 422 { 
 "tools" : [ 
 { 
 "name" : "<string>" , 
 "description" : "<string>" 
 } 
 ] 
} MCP Server Metadata

Get Tools

Get list of tool names for a specific MCP server. Mainly used for querying metadata about the MCP server.

GET / mcp-server / tools / {server_name} Try it

Authorizations

​ Authorization string header required

Your Klavis AI API key.

Path Parameters

​ server_name enum<string> required

The name of the target MCP server. Case-insensitive (e.g., 'google calendar', 'GOOGLE_CALENDAR', 'Google Calendar' are all valid).

Available options: Affinity , Airtable , Asana , Attio , Brave Search , ClickUp , Close , Confluence , Discord , Doc2markdown , Firecrawl Deep Research , Firecrawl Web Search , GitHub , Gmail , Gong , Google Calendar , Google Docs , Google Drive , Google Sheets , HubSpot , Jira , Klavis ReportGen , Linear , LinkedIn , Markdown2doc , Motion , Notion , Plai , Postgres , QuickBooks , Resend , Salesforce , Slack , Supabase , WhatsApp , WordPress , YouTube 

Response

200 application/json

Successful Response

​ tools ServerTool · object[]

List of available tools with their descriptions

Show child attributes

Get All Servers List Tools github linkedin discord Powered by Mintlify Get Tools - Klavis AI ------------------------------------

||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

----------- WEB PAGE -----------

TITLE: List Tools - Klavis AI

URL: https://docs.klavis.ai/api-reference/mcp-server/list-tools

CONTENT:

Klavis AI home page Search... ⌘ K Ask AI

Dashboard

Klavis-AI / klavis 3,940

Documentation

API Reference

Knowledge Base

API References

Introduction

Manage MCP Server

POST Create Server Instance

POST Create Unified MCP Server Instance

GET Get Server Instance

DEL Delete Server Instance

MCP Server Metadata

GET Get All Servers

GET Get Tools

Function Calling with MCP

POST List Tools

POST Call Tool

User

GET Get User Instances

DEL Delete User

White Labeling

POST Create White Label

GET Get White Label

Auth / OAuth

POST Get OAuth URL

POST Set Auth Token

GET Get Authentication Metadata

DEL Delete Auth data for Server Instance

GitHub OAuth

Slack OAuth

Jira OAuth

Notion OAuth

Supabase OAuth

WordPress OAuth

Gmail OAuth

Google Calendar OAuth

Google Drive OAuth

Google Docs OAuth

Google Sheets OAuth

Airtable OAuth

Asana OAuth

Close OAuth

Confluence OAuth

Salesforce OAuth

Linear OAuth

Linkedin OAuth

Attio OAuth

Canva OAuth

Xero OAuth

Dropbox OAuth

QuickBooks OAuth

List Tools

cURL

curl --request POST \ 
 --url https://api.klavis.ai/mcp-server/list-tools \ 
 --header 'Authorization: Bearer <token>' \ 
 --header 'Content-Type: application/json' \ 
 --data '{ 
 "serverUrl": "<string>", 
 "connectionType": "StreamableHttp", 
 "format": "mcp_native" 
}' 200 422 { 
 "success" : true , 
 "tools" : [ 
 "<any>" 
 ], 
 "format" : "openai" , 
 "error" : "<string>" 
} Function Calling with MCP

List Tools

Lists all tools available for a specific remote MCP server in various AI model formats.

This eliminates the need for manual MCP code implementation and format conversion. Under the hood, Klavis instantiates an MCP client and establishes a connection with the remote MCP server to retrieve available tools.

POST / mcp-server / list-tools Try it

Authorizations

​ Authorization string header required

Your Klavis AI API key.

Body

application/json ​ serverUrl string required

The full URL for connecting to the MCP server

​ connectionType enum<string>

The connection type to use for the MCP server. Default is STREAMABLE_HTTP.

Available options: SSE , StreamableHttp ​ format enum<string>

The format to return tools in. Default is MCP Native format for maximum compatibility.

Available options: openai , anthropic , gemini , mcp_native 

Response

200 application/json

Successful Response

​ success boolean required

Whether the list tools request was successful

​ format enum<string> required

The format of the returned tools

Available options: openai , anthropic , gemini , mcp_native ​ tools any[] | null

List of tools in the requested format

​ error string | null

Error message, if the request failed

Get Tools Call Tool github linkedin discord Powered by Mintlify List Tools - Klavis AI ------------------------------------

||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
----------- WEB PAGE -----------

TITLE: Call Tool - Klavis AI

URL: https://docs.klavis.ai/api-reference/mcp-server/call-tool

CONTENT:

Klavis AI home page Search... ⌘ K Ask AI

Dashboard

Klavis-AI / klavis 3,940

Documentation

API Reference

Knowledge Base

API References

Introduction

Manage MCP Server

POST Create Server Instance

POST Create Unified MCP Server Instance

GET Get Server Instance

DEL Delete Server Instance

MCP Server Metadata

GET Get All Servers

GET Get Tools

Function Calling with MCP

POST List Tools

POST Call Tool

User

GET Get User Instances

DEL Delete User

White Labeling

POST Create White Label

GET Get White Label

Auth / OAuth

POST Get OAuth URL

POST Set Auth Token

GET Get Authentication Metadata

DEL Delete Auth data for Server Instance

GitHub OAuth

Slack OAuth

Jira OAuth

Notion OAuth

Supabase OAuth

WordPress OAuth

Gmail OAuth

Google Calendar OAuth

Google Drive OAuth

Google Docs OAuth

Google Sheets OAuth

Airtable OAuth

Asana OAuth

Close OAuth

Confluence OAuth

Salesforce OAuth

Linear OAuth

Linkedin OAuth

Attio OAuth

Canva OAuth

Xero OAuth

Dropbox OAuth

QuickBooks OAuth

Call Tool

cURL

curl --request POST \ 
 --url https://api.klavis.ai/mcp-server/call-tool \ 
 --header 'Authorization: Bearer <token>' \ 
 --header 'Content-Type: application/json' \ 
 --data '{ 
 "serverUrl": "<string>", 
 "toolName": "<string>", 
 "toolArgs": {}, 
 "connectionType": "StreamableHttp" 
}' 200 422 { 
 "success" : true , 
 "result" : { 
 "content" : [ 
 "<any>" 
 ], 
 "isError" : false 
 }, 
 "error" : "<string>" 
} Function Calling with MCP

Call Tool

Calls a tool on a specific remote MCP server, used for function calling. Eliminates the need for manual MCP code implementation. Under the hood, Klavis will instantiates an MCP client and establishes a connection with the remote MCP server to call the tool.

POST / mcp-server / call-tool Try it

Authorizations

​ Authorization string header required

Your Klavis AI API key.

Body

application/json ​ serverUrl string required

The full URL for connecting to the MCP server

​ toolName string required

The name of the tool to call

​ toolArgs object

The input parameters for the tool

​ connectionType enum<string>

The connection type to use for the MCP server. Default is STREAMABLE_HTTP.

Available options: SSE , StreamableHttp 

Response

200 application/json

Successful Response

​ success boolean required

Whether the API call was successful

​ result object | null

The result of the tool call, if successful
The server's response to a tool call.

Show child attributes

​ error string | null

Error message, if the tool call failed

List Tools Get User Instances github linkedin discord Powered by Mintlify Call Tool - Klavis AI ------------------------------------

||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
----------- WEB PAGE -----------

TITLE: Get User Instances - Klavis AI

URL: https://docs.klavis.ai/api-reference/user/get-user-instances

CONTENT:

Klavis AI home page Search... ⌘ K Ask AI

Dashboard

Klavis-AI / klavis 3,940

Documentation

API Reference

Knowledge Base

API References

Introduction

Manage MCP Server

POST Create Server Instance

POST Create Unified MCP Server Instance

GET Get Server Instance

DEL Delete Server Instance

MCP Server Metadata

GET Get All Servers

GET Get Tools

Function Calling with MCP

POST List Tools

POST Call Tool

User

GET Get User Instances

DEL Delete User

White Labeling

POST Create White Label

GET Get White Label

Auth / OAuth

POST Get OAuth URL

POST Set Auth Token

GET Get Authentication Metadata

DEL Delete Auth data for Server Instance

GitHub OAuth

Slack OAuth

Jira OAuth

Notion OAuth

Supabase OAuth

WordPress OAuth

Gmail OAuth

Google Calendar OAuth

Google Drive OAuth

Google Docs OAuth

Google Sheets OAuth

Airtable OAuth

Asana OAuth

Close OAuth

Confluence OAuth

Salesforce OAuth

Linear OAuth

Linkedin OAuth

Attio OAuth

Canva OAuth

Xero OAuth

Dropbox OAuth

QuickBooks OAuth

Get User Instances

cURL

curl --request GET \ 
 --url https://api.klavis.ai/user/instances \ 
 --header 'Authorization: Bearer <token>' 200 422 { 
 "instances" : [ 
 { 
 "id" : "3c90c3cc-0d44-4b50-8888-8dd25736052a" , 
 "name" : "<string>" , 
 "description" : "<string>" , 
 "tools" : [ 
 { 
 "name" : "<string>" , 
 "description" : "<string>" 
 } 
 ], 
 "authNeeded" : true , 
 "isAuthenticated" : false 
 } 
 ] 
} User

Get User Instances

Get all MCP server instances information by user ID and platform name.

GET / user / instances Try it

Authorizations

​ Authorization string header required

Your Klavis AI API key.

Query Parameters

​ user_id string required

The external user ID

​ platform_name string required

The platform name

Response

200 application/json

Successful Response

​ instances ExtendedMcpServer · object[] required

Show child attributes

Call Tool Delete User github linkedin discord Powered by Mintlify Get User Instances - Klavis AI ------------------------------------

||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

----------- WEB PAGE -----------

TITLE: Delete User - Klavis AI

URL: https://docs.klavis.ai/api-reference/user/delete-user

CONTENT:

Klavis AI home page Search... ⌘ K Ask AI

Dashboard

Klavis-AI / klavis 3,940

Documentation

API Reference

Knowledge Base

API References

Introduction

Manage MCP Server

POST Create Server Instance

POST Create Unified MCP Server Instance

GET Get Server Instance

DEL Delete Server Instance

MCP Server Metadata

GET Get All Servers

GET Get Tools

Function Calling with MCP

POST List Tools

POST Call Tool

User

GET Get User Instances

DEL Delete User

White Labeling

POST Create White Label

GET Get White Label

Auth / OAuth

POST Get OAuth URL

POST Set Auth Token

GET Get Authentication Metadata

DEL Delete Auth data for Server Instance

GitHub OAuth

Slack OAuth

Jira OAuth

Notion OAuth

Supabase OAuth

WordPress OAuth

Gmail OAuth

Google Calendar OAuth

Google Drive OAuth

Google Docs OAuth

Google Sheets OAuth

Airtable OAuth

Asana OAuth

Close OAuth

Confluence OAuth

Salesforce OAuth

Linear OAuth

Linkedin OAuth

Attio OAuth

Canva OAuth

Xero OAuth

Dropbox OAuth

QuickBooks OAuth

Delete User

cURL

curl --request DELETE \ 
 --url https://api.klavis.ai/user/delete/{user_id} \ 
 --header 'Authorization: Bearer <token>' 200 422 { 
 "success" : true , 
 "message" : "<string>" 
} User

Delete User

Delete a user and all associated data by user_id. Users cannot delete their own accounts. This operation will permanently remove all user data.

DELETE / user / delete / {user_id} Try it

Authorizations

​ Authorization string header required

Your Klavis AI API key.

Path Parameters

​ user_id string required

The identifier for the user to delete.

Minimum length: 1

Response

200 application/json

Successful Response

​ success boolean required ​ message string required Get User Instances Create White Label github linkedin discord Powered by Mintlify Delete User - Klavis AI ------------------------------------






