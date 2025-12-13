import { z } from "zod";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:4000/api";

// Helper function to make HTTP requests
export async function makeRequest(method, url, data = null, options = {}) {
  const config = {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  };

  // Merge other options except headers (which we already handled)
  const { headers: _, ...otherOptions } = options;
  Object.assign(config, otherOptions);

  if (data) {
    config.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, config);
    const result = await response.text();

    let jsonResult;
    try {
      jsonResult = JSON.parse(result);
    } catch {
      jsonResult = result;
    }

    return {
      status: response.status,
      data: jsonResult,
      headers: Object.fromEntries(response.headers.entries()),
    };
  } catch (error) {
    return {
      status: 0,
      error: error.message,
    };
  }
}

// Issues API functions

export async function listIssues(filters = {}, apiKey, internal = false) {
  const queryParams = {};

  if (filters.status) queryParams.status = filters.status;
  if (filters.assigned_user_id) queryParams.assigned_user_id = filters.assigned_user_id;
  if (filters.tag_id) queryParams.tag_id = filters.tag_id;
  if (filters.search) queryParams.search = filters.search;
  if (filters.page) queryParams.page = filters.page;
  if (filters.limit) queryParams.limit = filters.limit;
  if (filters.priority) queryParams.priority = filters.priority;
  if (filters.created_by_user_id) queryParams.created_by_user_id = filters.created_by_user_id;

  const searchParams = new URLSearchParams();

  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, value);
    }
  });

  const url = `${API_BASE_URL}/issues${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  const headers = {};
  if (!internal && apiKey) {
    headers["x-api-key"] = apiKey;
  }

  return await makeRequest("GET", url, null, { headers });
}

export async function createIssue(issueData, apiKey, internal = false) {
  const headers = {};
  if (!internal && apiKey) {
    headers["x-api-key"] = apiKey;
  }

  return await makeRequest("POST", `${API_BASE_URL}/issues`, issueData, { headers });
}

export async function getIssue(id, apiKey, internal = false) {
  const headers = {};
  if (!internal && apiKey) {
    headers["x-api-key"] = apiKey;
  }

  return await makeRequest("GET", `${API_BASE_URL}/issues/${id}`, null, { headers });
}

export async function updateIssue(id, updateData, apiKey, internal = false) {
  const headers = {};
  if (!internal && apiKey) {
    headers["x-api-key"] = apiKey;
  }

  return await makeRequest("PUT", `${API_BASE_URL}/issues/${id}`, updateData, { headers });
}

export async function deleteIssue(id, apiKey, internal = false) {
  const headers = {};
  if (!internal && apiKey) {
    headers["x-api-key"] = apiKey;
  }

  return await makeRequest("DELETE", `${API_BASE_URL}/issues/${id}`, null, { headers });
}

// Tags API functions

export async function listTags(apiKey) {
  return await makeRequest("GET", `${API_BASE_URL}/tags`, null, {
    headers: { "x-api-key": apiKey },
  });
}

export async function createTag(tagData, apiKey) {
  return await makeRequest("POST", `${API_BASE_URL}/tags`, tagData, {
    headers: { "x-api-key": apiKey },
  });
}

export async function deleteTag(id, apiKey) {
  return await makeRequest("DELETE", `${API_BASE_URL}/tags/${id}`, null, {
    headers: { "x-api-key": apiKey },
  });
}

// Users API functions

export async function listUsers(apiKey) {
  return await makeRequest("GET", `${API_BASE_URL}/users`, null, {
    headers: { "x-api-key": apiKey },
  });
}

// Auth API functions

export async function verifyApiKey(apiKey) {
  return await makeRequest("POST", `${API_BASE_URL}/auth/api-key/verify`, { key: apiKey });
}

// Health API functions

export async function getHealthStatus() {
  return await makeRequest("GET", `${API_BASE_URL.replace("/api", "")}/health`);
}

export async function getHealthReady() {
  return await makeRequest("GET", `${API_BASE_URL.replace("/api", "")}/health/ready`);
}

export async function getHealthLive() {
  return await makeRequest("GET", `${API_BASE_URL.replace("/api", "")}/health/live`);
}