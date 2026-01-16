/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export interface Migration {
  version: number
  name: string
  up: string
}

export const migrations: Migration[] = [
  {
    version: 1768440691,
    name: '0000_living_deathbird',
    up: `
CREATE TABLE \`conversations\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`browseros_id\` text NOT NULL,
	\`provider\` text NOT NULL,
	\`model\` text,
	\`title\` text,
	\`created_at\` text DEFAULT (datetime('now')) NOT NULL,
	\`updated_at\` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX \`idx_conversations_browseros_id\` ON \`conversations\` (\`browseros_id\`);--> statement-breakpoint
CREATE TABLE \`messages\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`conversation_id\` text NOT NULL,
	\`role\` text NOT NULL,
	\`content\` text NOT NULL,
	\`created_at\` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (\`conversation_id\`) REFERENCES \`conversations\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "role_check" CHECK("messages"."role" IN ('user', 'assistant', 'system'))
);
--> statement-breakpoint
CREATE INDEX \`idx_messages_conversation_id\` ON \`messages\` (\`conversation_id\`);--> statement-breakpoint
CREATE TABLE \`identity\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`browseros_id\` text NOT NULL,
	\`created_at\` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT "singleton_check" CHECK("identity"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE \`rate_limiter\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`browseros_id\` text NOT NULL,
	\`provider\` text NOT NULL,
	\`created_at\` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX \`idx_rate_limiter_browseros_id_date\` ON \`rate_limiter\` (\`browseros_id\`,\`created_at\`);
    `,
  },
]
