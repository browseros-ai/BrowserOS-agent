#

[Klavis AI home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)](https://www.klavis.ai/)

Search...

Ctrl KAsk AI

Search...

Navigation

Gmail OAuth

Authorize Gmail

Authorize Gmail

cURL

Copy

Ask AI

```
curl --request GET \
  --url https://api.klavis.ai/oauth/gmail/authorize
```

200

422

Copy

Ask AI

```
"<any>"
```

GET

/

oauth

/

gmail

/

authorize

Try it

Authorize Gmail

cURL

Copy

Ask AI

```
curl --request GET \
  --url https://api.klavis.ai/oauth/gmail/authorize
```

200

422

Copy

Ask AI

```
"<any>"
```

Assistant

Responses are generated using AI and may contain mistakes.

#### Query Parameters

[​](https://docs.klavis.ai/api-reference/gmail-oauth/authorize-gmail#parameter-instance-id)

instance\_id

string

required

Unique identifier for the client instance requesting authorization

[​](https://docs.klavis.ai/api-reference/gmail-oauth/authorize-gmail#parameter-client-id)

client\_id

string \| null

Client ID for white labeling, if not provided will use default credentials

[​](https://docs.klavis.ai/api-reference/gmail-oauth/authorize-gmail#parameter-scope)

scope

string \| null

Optional OAuth scopes to request (comma-separated string)

[​](https://docs.klavis.ai/api-reference/gmail-oauth/authorize-gmail#parameter-redirect-url)

redirect\_url

string \| null

Optional URL to redirect to after authorization completes

#### Response

200

200422

application/json

Successful Response

The response is of type `any`.

[Authorize Wordpress](https://docs.klavis.ai/api-reference/wordpress-oauth/authorize-wordpress) [Authorize Gcalendar](https://docs.klavis.ai/api-reference/google-calendar-oauth/authorize-google-calendar)

------------------------------

#

[Klavis AI home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)](https://www.klavis.ai/)

Search...

Ctrl KAsk AI

Search...

Navigation

API References

Introduction

On this page

- [Base URL](https://docs.klavis.ai/api-reference/introduction#base-url)
- [Authentication](https://docs.klavis.ai/api-reference/introduction#authentication)
- [Response codes](https://docs.klavis.ai/api-reference/introduction#response-codes)
- [Rate limit](https://docs.klavis.ai/api-reference/introduction#rate-limit)

## [​](https://docs.klavis.ai/api-reference/introduction\#base-url)  Base URL

The Klavis API is built on REST principles. We enforce HTTPS in every request to improve data security, integrity, and privacy. The API does not support HTTP.

All requests contain the following base URL:

Copy

Ask AI

```
https://api.klavis.ai

```

## [​](https://docs.klavis.ai/api-reference/introduction\#authentication)  Authentication

To authenticate you need to add an Authorization header with the contents of the header being Bearer key\_123456789 where key\_123456789 is your API Key.

Copy

Ask AI

```
Authorization: Bearer key_123456789

```

## [​](https://docs.klavis.ai/api-reference/introduction\#response-codes)  Response codes

Klavis uses standard HTTP codes to indicate the success or failure of your requests.

In general, 2xx HTTP codes correspond to success, 4xx codes are for user-related failures, and 5xx codes are for infrastructure issues.

| Status | Description |
| --- | --- |
| 200 | Successful request. |
| 400 | Check that the parameters were correct. |
| 401 | The API key used was missing. |
| 403 | The API key used was invalid. |
| 404 | The resource was not found. |
| 429 | The rate limit was exceeded. |
| 5xx | Indicates an error with Klavis servers. |

Check Error Codes for a comprehensive breakdown of all possible API errors.

## [​](https://docs.klavis.ai/api-reference/introduction\#rate-limit)  Rate limit

The default maximum rate limit is 2 requests per second. This number can be increased for trusted senders by request. After that, you’ll hit the rate limit and receive a 429 response error code.

Assistant

Responses are generated using AI and may contain mistakes.

[Create a Server Instance](https://docs.klavis.ai/api-reference/mcp-server/create-a-server-instance)

------------------------------

#

[Klavis AI home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)](https://www.klavis.ai/)

Search...

Ctrl KAsk AI

Search...

Navigation

Function Calling with MCP

Call Tool

Call Tool

cURL

Copy

Ask AI

```
curl --request POST \
  --url https://api.klavis.ai/mcp-server/call-tool \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "serverUrl": "<string>",
  "toolName": "<string>",
  "toolArgs": {},
  "connectionType": "StreamableHttp"
}'
```

200

422

Copy

Ask AI

```
{
  "success": true,
  "result": {
    "content": [\
      "<any>"\
    ],
    "isError": false
  },
  "error": "<string>"
}
```

POST

/

mcp-server

/

call-tool

Try it

Call Tool

cURL

Copy

Ask AI

```
curl --request POST \
  --url https://api.klavis.ai/mcp-server/call-tool \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "serverUrl": "<string>",
  "toolName": "<string>",
  "toolArgs": {},
  "connectionType": "StreamableHttp"
}'
```

200

422

Copy

Ask AI

```
{
  "success": true,
  "result": {
    "content": [\
      "<any>"\
    ],
    "isError": false
  },
  "error": "<string>"
}
```

Assistant

Responses are generated using AI and may contain mistakes.

#### Authorizations

[​](https://docs.klavis.ai/api-reference/mcp-server/call-tool#authorization-authorization)

Authorization

string

header

required

Your Klavis AI API key.

#### Body

application/json

[​](https://docs.klavis.ai/api-reference/mcp-server/call-tool#body-server-url)

serverUrl

string

required

The full URL for connecting to the MCP server

[​](https://docs.klavis.ai/api-reference/mcp-server/call-tool#body-tool-name)

toolName

string

required

The name of the tool to call

[​](https://docs.klavis.ai/api-reference/mcp-server/call-tool#body-tool-args)

toolArgs

object

The input parameters for the tool

[​](https://docs.klavis.ai/api-reference/mcp-server/call-tool#body-connection-type)

connectionType

enum<string>

The connection type to use for the MCP server. Default is STREAMABLE\_HTTP.

Available options:

`SSE`,

`StreamableHttp`

#### Response

200

200422

application/json

Successful Response

[​](https://docs.klavis.ai/api-reference/mcp-server/call-tool#response-success)

success

boolean

required

Whether the API call was successful

[​](https://docs.klavis.ai/api-reference/mcp-server/call-tool#response-result)

result

object \| null

The result of the tool call, if successful
The server's response to a tool call.

Show child attributes

[​](https://docs.klavis.ai/api-reference/mcp-server/call-tool#response-result-content)

result.content

any\[\]

required

The content of the tool call

[​](https://docs.klavis.ai/api-reference/mcp-server/call-tool#response-result-is-error)

result.isError

boolean

default:false

Whether the tool call was successful

[​](https://docs.klavis.ai/api-reference/mcp-server/call-tool#response-error)

error

string \| null

Error message, if the tool call failed

[List Tools](https://docs.klavis.ai/api-reference/mcp-server/list-tools) [Get user instances](https://docs.klavis.ai/api-reference/user/get-server-instances)

------------------------------

#

[Klavis AI home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)](https://www.klavis.ai/)

Search...

Ctrl KAsk AI

Search...

Navigation

Manage MCP Server

Create a Server Instance

Create a Server Instance

cURL

Copy

Ask AI

```
curl --request POST \
  --url https://api.klavis.ai/mcp-server/instance/create \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "serverName": "Affinity",
  "userId": "<string>",
  "platformName": "<string>",
  "connectionType": "StreamableHttp"
}'
```

200

422

Copy

Ask AI

```
{
  "serverUrl": "<string>",
  "instanceId": "<string>",
  "oauthUrl": "<string>"
}
```

POST

/

mcp-server

/

instance

/

create

Try it

Create a Server Instance

cURL

Copy

Ask AI

```
curl --request POST \
  --url https://api.klavis.ai/mcp-server/instance/create \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "serverName": "Affinity",
  "userId": "<string>",
  "platformName": "<string>",
  "connectionType": "StreamableHttp"
}'
```

200

422

Copy

Ask AI

```
{
  "serverUrl": "<string>",
  "instanceId": "<string>",
  "oauthUrl": "<string>"
}
```

Assistant

Responses are generated using AI and may contain mistakes.

#### Authorizations

[​](https://docs.klavis.ai/api-reference/mcp-server/create-a-server-instance#authorization-authorization)

Authorization

string

header

required

Your Klavis AI API key.

#### Body

application/json

[​](https://docs.klavis.ai/api-reference/mcp-server/create-a-server-instance#body-server-name)

serverName

enum<string>

required

The name of the target MCP server.

Available options:

`Affinity`,

`Airtable`,

`Asana`,

`Attio`,

`ClickUp`,

`Close`,

`Confluence`,

`Discord`,

`Doc2markdown`,

`Firecrawl Deep Research`,

`Firecrawl Web Search`,

`GitHub`,

`Gmail`,

`Gong`,

`Google Calendar`,

`Google Docs`,

`Google Drive`,

`Google Sheets`,

`HubSpot`,

`Jira`,

`Klavis ReportGen`,

`Linear`,

`Markdown2doc`,

`Notion`,

`Plai`,

`Postgres`,

`Resend`,

`Salesforce`,

`Slack`,

`Supabase`,

`WhatsApp`,

`WordPress`,

`YouTube`

[​](https://docs.klavis.ai/api-reference/mcp-server/create-a-server-instance#body-user-id)

userId

string

required

The identifier for the user requesting the server URL.

Minimum length: `1`

[​](https://docs.klavis.ai/api-reference/mcp-server/create-a-server-instance#body-platform-name)

platformName

string

required

The name of the platform associated with the user.

Minimum length: `1`

[​](https://docs.klavis.ai/api-reference/mcp-server/create-a-server-instance#body-connection-type)

connectionType

enum<string>

The connection type to use for the MCP server. Default is STREAMABLE\_HTTP.

Available options:

`SSE`,

`StreamableHttp`

#### Response

200

200422

application/json

Successful Response

[​](https://docs.klavis.ai/api-reference/mcp-server/create-a-server-instance#response-server-url)

serverUrl

string

required

The full URL for connecting to the MCP server, including the instance ID.

[​](https://docs.klavis.ai/api-reference/mcp-server/create-a-server-instance#response-instance-id)

instanceId

string

required

The unique identifier for this specific server connection instance.

[​](https://docs.klavis.ai/api-reference/mcp-server/create-a-server-instance#response-oauth-url)

oauthUrl

string \| null

The OAuth authorization URL for the specified server, if OAuth is configured.

[Introduction](https://docs.klavis.ai/api-reference/introduction) [Get Server Instance](https://docs.klavis.ai/api-reference/mcp-server/get-server-instance)

------------------------------

#

[Klavis AI home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)](https://www.klavis.ai/)

Search...

Ctrl KAsk AI

Search...

Navigation

Manage MCP Server

Delete a Server Instance

Delete a Server Instance

cURL

Copy

Ask AI

```
curl --request DELETE \
  --url https://api.klavis.ai/mcp-server/instance/delete/{instance_id} \
  --header 'Authorization: Bearer <token>'
```

200

422

Copy

Ask AI

```
{
  "success": true,
  "message": "<string>"
}
```

DELETE

/

mcp-server

/

instance

/

delete

/

{instance\_id}

Try it

Delete a Server Instance

cURL

Copy

Ask AI

```
curl --request DELETE \
  --url https://api.klavis.ai/mcp-server/instance/delete/{instance_id} \
  --header 'Authorization: Bearer <token>'
```

200

422

Copy

Ask AI

```
{
  "success": true,
  "message": "<string>"
}
```

Assistant

Responses are generated using AI and may contain mistakes.

#### Authorizations

[​](https://docs.klavis.ai/api-reference/mcp-server/delete-a-server-instance#authorization-authorization)

Authorization

string

header

required

Your Klavis AI API key.

#### Path Parameters

[​](https://docs.klavis.ai/api-reference/mcp-server/delete-a-server-instance#parameter-instance-id)

instance\_id

string

required

The ID of the connection instance to delete.

#### Response

200

200422

application/json

Successful Response

[​](https://docs.klavis.ai/api-reference/mcp-server/delete-a-server-instance#response-success)

success

boolean

required

[​](https://docs.klavis.ai/api-reference/mcp-server/delete-a-server-instance#response-message)

message

string \| null

[Get Server Instance](https://docs.klavis.ai/api-reference/mcp-server/get-server-instance) [Get All Servers](https://docs.klavis.ai/api-reference/mcp-server/get-all-servers)

------------------------------

#

[Klavis AI home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)](https://www.klavis.ai/)

Search...

Ctrl KAsk AI

Search...

Navigation

Auth / OAuth

Delete Auth data for a Server Instance

Delete Auth data for a Server Instance

cURL

Copy

Ask AI

```
curl --request DELETE \
  --url https://api.klavis.ai/mcp-server/instance/delete-auth/{instance_id} \
  --header 'Authorization: Bearer <token>'
```

200

422

Copy

Ask AI

```
{
  "success": true,
  "message": "<string>"
}
```

DELETE

/

mcp-server

/

instance

/

delete-auth

/

{instance\_id}

Try it

Delete Auth data for a Server Instance

cURL

Copy

Ask AI

```
curl --request DELETE \
  --url https://api.klavis.ai/mcp-server/instance/delete-auth/{instance_id} \
  --header 'Authorization: Bearer <token>'
```

200

422

Copy

Ask AI

```
{
  "success": true,
  "message": "<string>"
}
```

Assistant

Responses are generated using AI and may contain mistakes.

#### Authorizations

[​](https://docs.klavis.ai/api-reference/mcp-server/delete-auth-data-for-a-server-instance#authorization-authorization)

Authorization

string

header

required

Your Klavis AI API key.

#### Path Parameters

[​](https://docs.klavis.ai/api-reference/mcp-server/delete-auth-data-for-a-server-instance#parameter-instance-id)

instance\_id

string

required

The ID of the connection instance to delete auth for.

#### Response

200

200422

application/json

Successful Response

[​](https://docs.klavis.ai/api-reference/mcp-server/delete-auth-data-for-a-server-instance#response-success)

success

boolean

required

[​](https://docs.klavis.ai/api-reference/mcp-server/delete-auth-data-for-a-server-instance#response-message)

message

string \| null

[Get Authentication Metadata](https://docs.klavis.ai/api-reference/mcp-server/get-auth-metadata) [Authorize Github](https://docs.klavis.ai/api-reference/github-oauth/authorize-github)

------------------------------

#

[Klavis AI home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)](https://www.klavis.ai/)

Search...

Ctrl KAsk AI

Search...

Navigation

MCP Server Metadata

Get All Servers

Get All Servers

cURL

Copy

Ask AI

```
curl --request GET \
  --url https://api.klavis.ai/mcp-server/servers \
  --header 'Authorization: Bearer <token>'
```

200

Copy

Ask AI

```
{
  "servers": [\
    {\
      "id": "3c90c3cc-0d44-4b50-8888-8dd25736052a",\
      "name": "<string>",\
      "description": "<string>",\
      "tools": [\
        {\
          "name": "<string>",\
          "description": "<string>"\
        }\
      ],\
      "authNeeded": true\
    }\
  ]
}
```

GET

/

mcp-server

/

servers

Try it

Get All Servers

cURL

Copy

Ask AI

```
curl --request GET \
  --url https://api.klavis.ai/mcp-server/servers \
  --header 'Authorization: Bearer <token>'
```

200

Copy

Ask AI

```
{
  "servers": [\
    {\
      "id": "3c90c3cc-0d44-4b50-8888-8dd25736052a",\
      "name": "<string>",\
      "description": "<string>",\
      "tools": [\
        {\
          "name": "<string>",\
          "description": "<string>"\
        }\
      ],\
      "authNeeded": true\
    }\
  ]
}
```

Assistant

Responses are generated using AI and may contain mistakes.

#### Authorizations

[​](https://docs.klavis.ai/api-reference/mcp-server/get-all-servers#authorization-authorization)

Authorization

string

header

required

Your Klavis AI API key.

#### Response

200 - application/json

Successful Response

[​](https://docs.klavis.ai/api-reference/mcp-server/get-all-servers#response-servers)

servers

McpServer · object\[\]

required

Show child attributes

[​](https://docs.klavis.ai/api-reference/mcp-server/get-all-servers#response-servers-id)

id

string

required

[​](https://docs.klavis.ai/api-reference/mcp-server/get-all-servers#response-servers-name)

name

string

required

[​](https://docs.klavis.ai/api-reference/mcp-server/get-all-servers#response-servers-description)

description

string \| null

[​](https://docs.klavis.ai/api-reference/mcp-server/get-all-servers#response-servers-tools)

tools

ServerTool · object\[\] \| null

[​](https://docs.klavis.ai/api-reference/mcp-server/get-all-servers#response-servers-auth-needed)

authNeeded

boolean

default:true

[Delete a Server Instance](https://docs.klavis.ai/api-reference/mcp-server/delete-a-server-instance) [Get Tools](https://docs.klavis.ai/api-reference/mcp-server/get-tools)

------------------------------

#

[Klavis AI home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)](https://www.klavis.ai/)

Search...

Ctrl KAsk AI

Search...

Navigation

Auth / OAuth

Get Authentication Metadata

Get Authentication Metadata

cURL

Copy

Ask AI

```
curl --request GET \
  --url https://api.klavis.ai/mcp-server/instance/get-auth/{instance_id} \
  --header 'Authorization: Bearer <token>'
```

200

422

Copy

Ask AI

```
{
  "success": true,
  "authData": {},
  "error": "<string>"
}
```

GET

/

mcp-server

/

instance

/

get-auth

/

{instance\_id}

Try it

Get Authentication Metadata

cURL

Copy

Ask AI

```
curl --request GET \
  --url https://api.klavis.ai/mcp-server/instance/get-auth/{instance_id} \
  --header 'Authorization: Bearer <token>'
```

200

422

Copy

Ask AI

```
{
  "success": true,
  "authData": {},
  "error": "<string>"
}
```

Assistant

Responses are generated using AI and may contain mistakes.

#### Authorizations

[​](https://docs.klavis.ai/api-reference/mcp-server/get-auth-metadata#authorization-authorization)

Authorization

string

header

required

Your Klavis AI API key.

#### Path Parameters

[​](https://docs.klavis.ai/api-reference/mcp-server/get-auth-metadata#parameter-instance-id)

instance\_id

string

required

The ID of the connection instance to get auth metadata for.

#### Response

200

200422

application/json

Successful Response

[​](https://docs.klavis.ai/api-reference/mcp-server/get-auth-metadata#response-success)

success

boolean

required

Whether the request was successful

[​](https://docs.klavis.ai/api-reference/mcp-server/get-auth-metadata#response-auth-data)

authData

object \| null

Complete authentication metadata including access token, refresh token, scope, expiration, and platform-specific data

[​](https://docs.klavis.ai/api-reference/mcp-server/get-auth-metadata#response-error)

error

string \| null

Error message if the request failed

[Set Auth Token](https://docs.klavis.ai/api-reference/mcp-server/set-auth-token) [Delete Auth data for a Server Instance](https://docs.klavis.ai/api-reference/mcp-server/delete-auth-data-for-a-server-instance)

------------------------------

#

[Klavis AI home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)](https://www.klavis.ai/)

Search...

Ctrl KAsk AI

Search...

Navigation

Auth / OAuth

Get OAuth URL

Get OAuth URL

cURL

Copy

Ask AI

```
curl --request POST \
  --url https://api.klavis.ai/mcp-server/oauth-url \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "serverName": "Affinity",
  "instanceId": "<string>",
  "clientId": "<string>",
  "scope": "<string>",
  "redirectUrl": "<string>"
}'
```

200

422

Copy

Ask AI

```
{
  "oauthUrl": "<string>"
}
```

POST

/

mcp-server

/

oauth-url

Try it

Get OAuth URL

cURL

Copy

Ask AI

```
curl --request POST \
  --url https://api.klavis.ai/mcp-server/oauth-url \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "serverName": "Affinity",
  "instanceId": "<string>",
  "clientId": "<string>",
  "scope": "<string>",
  "redirectUrl": "<string>"
}'
```

200

422

Copy

Ask AI

```
{
  "oauthUrl": "<string>"
}
```

Assistant

Responses are generated using AI and may contain mistakes.

#### Authorizations

[​](https://docs.klavis.ai/api-reference/mcp-server/get-oauth-url#authorization-authorization)

Authorization

string

header

required

Your Klavis AI API key.

#### Body

application/json

[​](https://docs.klavis.ai/api-reference/mcp-server/get-oauth-url#body-server-name)

serverName

enum<string>

required

The name of the target MCP server.

Available options:

`Affinity`,

`Airtable`,

`Asana`,

`Attio`,

`ClickUp`,

`Close`,

`Confluence`,

`Discord`,

`Doc2markdown`,

`Firecrawl Deep Research`,

`Firecrawl Web Search`,

`GitHub`,

`Gmail`,

`Gong`,

`Google Calendar`,

`Google Docs`,

`Google Drive`,

`Google Sheets`,

`HubSpot`,

`Jira`,

`Klavis ReportGen`,

`Linear`,

`Markdown2doc`,

`Notion`,

`Plai`,

`Postgres`,

`Resend`,

`Salesforce`,

`Slack`,

`Supabase`,

`WhatsApp`,

`WordPress`,

`YouTube`

[​](https://docs.klavis.ai/api-reference/mcp-server/get-oauth-url#body-instance-id)

instanceId

string

required

The unique identifier for the connection instance.

[​](https://docs.klavis.ai/api-reference/mcp-server/get-oauth-url#body-client-id)

clientId

string \| null

Optional client ID for white labeling. If not provided, will use default credentials.

[​](https://docs.klavis.ai/api-reference/mcp-server/get-oauth-url#body-scope)

scope

string \| null

Optional OAuth scopes to request (comma-separated string).

[​](https://docs.klavis.ai/api-reference/mcp-server/get-oauth-url#body-redirect-url)

redirectUrl

string \| null

Optional URL to redirect to after authorization completes.

#### Response

200

200422

application/json

Successful Response

[​](https://docs.klavis.ai/api-reference/mcp-server/get-oauth-url#response-oauth-url)

oauthUrl

string

required

The OAuth authorization URL for the specified server.

[Get](https://docs.klavis.ai/api-reference/white-labeling/get) [Set Auth Token](https://docs.klavis.ai/api-reference/mcp-server/set-auth-token)

------------------------------

#

[Klavis AI home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)](https://www.klavis.ai/)

Search...

Ctrl KAsk AI

Search...

Navigation

Manage MCP Server

Get Server Instance

Get Server Instance

cURL

Copy

Ask AI

```
curl --request GET \
  --url https://api.klavis.ai/mcp-server/instance/get/{instance_id} \
  --header 'Authorization: Bearer <token>'
```

200

422

Copy

Ask AI

```
{
  "instanceId": "<string>",
  "authNeeded": false,
  "isAuthenticated": false,
  "serverName": "",
  "platform": "",
  "externalUserId": ""
}
```

GET

/

mcp-server

/

instance

/

get

/

{instance\_id}

Try it

Get Server Instance

cURL

Copy

Ask AI

```
curl --request GET \
  --url https://api.klavis.ai/mcp-server/instance/get/{instance_id} \
  --header 'Authorization: Bearer <token>'
```

200

422

Copy

Ask AI

```
{
  "instanceId": "<string>",
  "authNeeded": false,
  "isAuthenticated": false,
  "serverName": "",
  "platform": "",
  "externalUserId": ""
}
```

Assistant

Responses are generated using AI and may contain mistakes.

#### Authorizations

[​](https://docs.klavis.ai/api-reference/mcp-server/get-server-instance#authorization-authorization)

Authorization

string

header

required

Your Klavis AI API key.

#### Path Parameters

[​](https://docs.klavis.ai/api-reference/mcp-server/get-server-instance#parameter-instance-id)

instance\_id

string

required

The ID of the connection instance whose status is being checked. This is returned by the Create API.

#### Response

200

200422

application/json

Successful Response

[​](https://docs.klavis.ai/api-reference/mcp-server/get-server-instance#response-instance-id)

instanceId

string \| null

The unique identifier of the connection instance.

[​](https://docs.klavis.ai/api-reference/mcp-server/get-server-instance#response-auth-needed)

authNeeded

boolean

default:false

Indicates whether authentication is required for this server instance.

[​](https://docs.klavis.ai/api-reference/mcp-server/get-server-instance#response-is-authenticated)

isAuthenticated

boolean

default:false

Indicates whether the instance is authenticated successfully.

[​](https://docs.klavis.ai/api-reference/mcp-server/get-server-instance#response-server-name)

serverName

string

default:""

The name of the MCP server associated with the instance.

[​](https://docs.klavis.ai/api-reference/mcp-server/get-server-instance#response-platform)

platform

string

default:""

The platform associated with the instance.

[​](https://docs.klavis.ai/api-reference/mcp-server/get-server-instance#response-external-user-id)

externalUserId

string

default:""

The user's identifier on the external platform.

[Create a Server Instance](https://docs.klavis.ai/api-reference/mcp-server/create-a-server-instance) [Delete a Server Instance](https://docs.klavis.ai/api-reference/mcp-server/delete-a-server-instance)

------------------------------

#

[Klavis AI home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)](https://www.klavis.ai/)

Search...

Ctrl KAsk AI

Search...

Navigation

MCP Server Metadata

Get Tools

Get Tools

cURL

Copy

Ask AI

```
curl --request GET \
  --url https://api.klavis.ai/mcp-server/tools/{server_name} \
  --header 'Authorization: Bearer <token>'
```

200

422

Copy

Ask AI

```
{
  "tools": [\
    {\
      "name": "<string>",\
      "description": "<string>"\
    }\
  ]
}
```

GET

/

mcp-server

/

tools

/

{server\_name}

Try it

Get Tools

cURL

Copy

Ask AI

```
curl --request GET \
  --url https://api.klavis.ai/mcp-server/tools/{server_name} \
  --header 'Authorization: Bearer <token>'
```

200

422

Copy

Ask AI

```
{
  "tools": [\
    {\
      "name": "<string>",\
      "description": "<string>"\
    }\
  ]
}
```

Assistant

Responses are generated using AI and may contain mistakes.

#### Authorizations

[​](https://docs.klavis.ai/api-reference/mcp-server/get-tools#authorization-authorization)

Authorization

string

header

required

Your Klavis AI API key.

#### Path Parameters

[​](https://docs.klavis.ai/api-reference/mcp-server/get-tools#parameter-server-name)

server\_name

enum<string>

required

The name of the target MCP server.

Available options:

`Affinity`,

`Airtable`,

`Asana`,

`Attio`,

`ClickUp`,

`Close`,

`Confluence`,

`Discord`,

`Doc2markdown`,

`Firecrawl Deep Research`,

`Firecrawl Web Search`,

`GitHub`,

`Gmail`,

`Gong`,

`Google Calendar`,

`Google Docs`,

`Google Drive`,

`Google Sheets`,

`HubSpot`,

`Jira`,

`Klavis ReportGen`,

`Linear`,

`Markdown2doc`,

`Notion`,

`Plai`,

`Postgres`,

`Resend`,

`Salesforce`,

`Slack`,

`Supabase`,

`WhatsApp`,

`WordPress`,

`YouTube`

#### Response

200

200422

application/json

Successful Response

[​](https://docs.klavis.ai/api-reference/mcp-server/get-tools#response-tools)

tools

ServerTool · object\[\]

List of available tools with their descriptions

Show child attributes

[​](https://docs.klavis.ai/api-reference/mcp-server/get-tools#response-tools-name)

name

string

required

[​](https://docs.klavis.ai/api-reference/mcp-server/get-tools#response-tools-description)

description

string

required

[Get All Servers](https://docs.klavis.ai/api-reference/mcp-server/get-all-servers) [List Tools](https://docs.klavis.ai/api-reference/mcp-server/list-tools)

------------------------------

#

[Klavis AI home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)](https://www.klavis.ai/)

Search...

Ctrl KAsk AI

Search...

Navigation

Function Calling with MCP

List Tools

List Tools

cURL

Copy

Ask AI

```
curl --request POST \
  --url https://api.klavis.ai/mcp-server/list-tools \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "serverUrl": "<string>",
  "connectionType": "StreamableHttp",
  "format": "mcp_native"
}'
```

200

422

Copy

Ask AI

```
{
  "success": true,
  "tools": [\
    "<any>"\
  ],
  "format": "openai",
  "error": "<string>"
}
```

POST

/

mcp-server

/

list-tools

Try it

List Tools

cURL

Copy

Ask AI

```
curl --request POST \
  --url https://api.klavis.ai/mcp-server/list-tools \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "serverUrl": "<string>",
  "connectionType": "StreamableHttp",
  "format": "mcp_native"
}'
```

200

422

Copy

Ask AI

```
{
  "success": true,
  "tools": [\
    "<any>"\
  ],
  "format": "openai",
  "error": "<string>"
}
```

Assistant

Responses are generated using AI and may contain mistakes.

#### Authorizations

[​](https://docs.klavis.ai/api-reference/mcp-server/list-tools#authorization-authorization)

Authorization

string

header

required

Your Klavis AI API key.

#### Body

application/json

[​](https://docs.klavis.ai/api-reference/mcp-server/list-tools#body-server-url)

serverUrl

string

required

The full URL for connecting to the MCP server

[​](https://docs.klavis.ai/api-reference/mcp-server/list-tools#body-connection-type)

connectionType

enum<string>

The connection type to use for the MCP server. Default is STREAMABLE\_HTTP.

Available options:

`SSE`,

`StreamableHttp`

[​](https://docs.klavis.ai/api-reference/mcp-server/list-tools#body-format)

format

enum<string>

The format to return tools in. Default is MCP Native format for maximum compatibility.

Available options:

`openai`,

`anthropic`,

`gemini`,

`mcp_native`

#### Response

200

200422

application/json

Successful Response

[​](https://docs.klavis.ai/api-reference/mcp-server/list-tools#response-success)

success

boolean

required

Whether the list tools request was successful

[​](https://docs.klavis.ai/api-reference/mcp-server/list-tools#response-format)

format

enum<string>

required

The format of the returned tools

Available options:

`openai`,

`anthropic`,

`gemini`,

`mcp_native`

[​](https://docs.klavis.ai/api-reference/mcp-server/list-tools#response-tools)

tools

any\[\] \| null

List of tools in the requested format

[​](https://docs.klavis.ai/api-reference/mcp-server/list-tools#response-error)

error

string \| null

Error message, if the request failed

[Get Tools](https://docs.klavis.ai/api-reference/mcp-server/get-tools) [Call Tool](https://docs.klavis.ai/api-reference/mcp-server/call-tool)

------------------------------

#

[Klavis AI home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)](https://www.klavis.ai/)

Search...

Ctrl KAsk AI

Search...

Navigation

Auth / OAuth

Set Auth Token

Set Auth Token

cURL

Copy

Ask AI

```
curl --request POST \
  --url https://api.klavis.ai/mcp-server/instance/set-auth-token \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "instanceId": "<string>",
  "authToken": "<string>"
}'
```

200

422

Copy

Ask AI

```
{
  "success": true,
  "message": "<string>"
}
```

POST

/

mcp-server

/

instance

/

set-auth-token

Try it

Set Auth Token

cURL

Copy

Ask AI

```
curl --request POST \
  --url https://api.klavis.ai/mcp-server/instance/set-auth-token \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "instanceId": "<string>",
  "authToken": "<string>"
}'
```

200

422

Copy

Ask AI

```
{
  "success": true,
  "message": "<string>"
}
```

Assistant

Responses are generated using AI and may contain mistakes.

#### Authorizations

[​](https://docs.klavis.ai/api-reference/mcp-server/set-auth-token#authorization-authorization)

Authorization

string

header

required

Your Klavis AI API key.

#### Body

application/json

[​](https://docs.klavis.ai/api-reference/mcp-server/set-auth-token#body-instance-id)

instanceId

string

required

The unique identifier for the connection instance

[​](https://docs.klavis.ai/api-reference/mcp-server/set-auth-token#body-auth-token)

authToken

string

required

The authentication token to save

#### Response

200

200422

application/json

Successful Response

[​](https://docs.klavis.ai/api-reference/mcp-server/set-auth-token#response-success)

success

boolean

required

[​](https://docs.klavis.ai/api-reference/mcp-server/set-auth-token#response-message)

message

string \| null

[Get OAuth URL](https://docs.klavis.ai/api-reference/mcp-server/get-oauth-url) [Get Authentication Metadata](https://docs.klavis.ai/api-reference/mcp-server/get-auth-metadata)

------------------------------

#

[Klavis AI home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/klavisai/images/logo/light.png)](https://www.klavis.ai/)

Search...

Ctrl KAsk AI

Search...

Navigation

User

Get user instances

Get user instances

cURL

Copy

Ask AI

```
curl --request GET \
  --url https://api.klavis.ai/user/instances \
  --header 'Authorization: Bearer <token>'
```

200

422

Copy

Ask AI

```
{
  "instances": [\
    {\
      "id": "3c90c3cc-0d44-4b50-8888-8dd25736052a",\
      "name": "<string>",\
      "description": "<string>",\
      "tools": [\
        {\
          "name": "<string>",\
          "description": "<string>"\
        }\
      ],\
      "authNeeded": true,\
      "isAuthenticated": false\
    }\
  ]
}
```

GET

/

user

/

instances

Try it

Get user instances

cURL

Copy

Ask AI

```
curl --request GET \
  --url https://api.klavis.ai/user/instances \
  --header 'Authorization: Bearer <token>'
```

200

422

Copy

Ask AI

```
{
  "instances": [\
    {\
      "id": "3c90c3cc-0d44-4b50-8888-8dd25736052a",\
      "name": "<string>",\
      "description": "<string>",\
      "tools": [\
        {\
          "name": "<string>",\
          "description": "<string>"\
        }\
      ],\
      "authNeeded": true,\
      "isAuthenticated": false\
    }\
  ]
}
```

Assistant

Responses are generated using AI and may contain mistakes.

#### Authorizations

[​](https://docs.klavis.ai/api-reference/user/get-server-instances#authorization-authorization)

Authorization

string

header

required

Your Klavis AI API key.

#### Query Parameters

[​](https://docs.klavis.ai/api-reference/user/get-server-instances#parameter-user-id)

user\_id

string

required

The external user ID

[​](https://docs.klavis.ai/api-reference/user/get-server-instances#parameter-platform-name)

platform\_name

string

required

The platform name

#### Response

200

200422

application/json

Successful Response

[​](https://docs.klavis.ai/api-reference/user/get-server-instances#response-instances)

instances

ExtendedMcpServer · object\[\]

required

Show child attributes

[Call Tool](https://docs.klavis.ai/api-reference/mcp-server/call-tool) [Create](https://docs.klavis.ai/api-reference/white-labeling/create)