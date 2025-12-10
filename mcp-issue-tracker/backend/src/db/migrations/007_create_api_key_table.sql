-- Migration: 007_create_api_key_table.sql
-- Adds storage for BetterAuth API keys

CREATE TABLE IF NOT EXISTS apikey (
	id TEXT PRIMARY KEY,
	userId TEXT NOT NULL,
	name TEXT,
	prefix TEXT,
	start TEXT,
	key TEXT NOT NULL UNIQUE,
	enabled INTEGER NOT NULL DEFAULT 1,
	metadata TEXT,
	requestCount INTEGER,
	refillAmount INTEGER,
	refillInterval INTEGER,
	lastRefillAt DATETIME,
	rateLimitTimeWindow INTEGER,
	rateLimitMax INTEGER,
	rateLimitEnabled INTEGER,
	lastRequest DATETIME,
	expiresAt DATETIME,
	permissions TEXT,
	createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_apikey_userId ON apikey(userId);
