import crypto from 'crypto';

// Simulate what the middleware does
const testApiKey = "my-test-api-key-12345";
const keyHash = crypto.createHash("sha256").update(testApiKey).digest("base64");

console.log("Test API Key:", testApiKey);
console.log("Hash:", keyHash);
console.log("\nTo test the API, use this header:");
console.log(`x-api-key: ${testApiKey}`);
