import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to the database
const dbPath = path.resolve(__dirname, 'mcp-issue-tracker', 'database.sqlite');

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}`);
  process.exit(1);
}

const db = new sqlite3.Database(dbPath);

// Helper to run queries
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function runUpdate(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

(async () => {
  try {
    // First, let's see what users exist
    console.log('\n=== Users ===');
    const users = await runQuery('SELECT id, name, email FROM user');
    console.log(users);
    
    if (users.length === 0) {
      console.log('No users found. Creating test user...');
      const userId = crypto.randomUUID();
      await runUpdate(`
        INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [userId, 'Test User', 'test@example.com', 1, new Date().toISOString(), new Date().toISOString()]);
      
      const newUser = await runQuery('SELECT id FROM user WHERE email = ?', ['test@example.com']);
      console.log('Created user:', newUser[0]);
      
      // Create API key for this user
      const apiKey = crypto.randomBytes(32).toString('hex');
      const keyHash = crypto.createHash('sha256').update(apiKey).digest('base64');
      
      const result = await runUpdate(`
        INSERT INTO apikey (userId, key, enabled, requestCount, remaining, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [newUser[0].id, keyHash, 1, 0, 1000, new Date().toISOString(), new Date().toISOString()]);
      
      console.log('\n=== Generated API Key ===');
      console.log('Plaintext Key:', apiKey);
      console.log('Hash (stored):', keyHash);
      console.log('\nTo test, run:');
      console.log(`Invoke-WebRequest -Uri "http://localhost:4000/api/issues" -Headers @{"x-api-key" = "${apiKey}"}`);
    } else {
      console.log('\n=== Checking API keys ===');
      const apiKeys = await runQuery('SELECT id, userId, enabled FROM apikey');
      console.log('API Keys:', apiKeys);
      
      if (apiKeys.length === 0) {
        console.log('No API keys found. Creating one for the first user...');
        const userId = users[0].id;
        const apiKey = crypto.randomBytes(32).toString('hex');
        const keyHash = crypto.createHash('sha256').update(apiKey).digest('base64');
        
        const result = await runUpdate(`
          INSERT INTO apikey (userId, key, enabled, requestCount, remaining, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [userId, keyHash, 1, 0, 1000, new Date().toISOString(), new Date().toISOString()]);
        
        console.log('\n=== Generated API Key ===');
        console.log('For user:', users[0].email);
        console.log('Plaintext Key:', apiKey);
        console.log('\nTo test, run:');
        console.log(`Invoke-WebRequest -Uri "http://localhost:4000/api/issues" -Headers @{"x-api-key" = "${apiKey}"}`);
      } else {
        console.log('\nExample test command:');
        console.log(`Invoke-WebRequest -Uri "http://localhost:4000/api/issues" -Headers @{"x-api-key" = "your-api-key-here"}`);
      }
    }
    
    db.close();
  } catch (error) {
    console.error('Error:', error.message);
    db.close();
  }
})();
