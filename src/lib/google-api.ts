// Helper for robust API calls with clear error messages and safe retry for transient errors
async function fetchWithRetry(url: string, options: RequestInit, retries = 2, backoff = 500): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (response.ok) return response;
    
    // Only retry on Rate Limit (429) or transient server errors (5xx)
    if ((response.status === 429 || response.status >= 500) && retries > 0) {
      await new Promise(res => setTimeout(res, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    
    let errorDetail = `Status ${response.status} (${response.statusText})`;
    try {
      const errJson = await response.json();
      if (errJson?.error?.message) {
        errorDetail = errJson.error.message;
      }
    } catch {
      // Ignore JSON parse failure
    }
    
    throw new Error(errorDetail);
  } catch (error: any) {
    if (retries > 0 && error?.name === 'TypeError') {
      // Network connection failure retry
      await new Promise(res => setTimeout(res, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
}

export async function fetchUserProfile(token: string) {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Could not load user profile info:', err);
  }
  return null;
}

export async function fetchCalendarEvents(token: string) {
  const now = new Date();
  const timeMin = new Date(now);
  if (now.getHours() < 2) {
    timeMin.setDate(timeMin.getDate() - 1);
  }
  timeMin.setHours(2, 0, 0, 0);

  const timeMax = new Date(timeMin);
  timeMax.setDate(timeMax.getDate() + 1);

  const response = await fetchWithRetry(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await response.json();
  return data.items || [];
}

export async function createCalendarEvent(token: string, summary: string, description: string, startTimeISO: string, endTimeISO: string, timeZone: string) {
  const response = await fetchWithRetry(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary,
        description,
        start: { dateTime: startTimeISO, timeZone },
        end: { dateTime: endTimeISO, timeZone },
      })
    }
  );
  return response.json();
}

export async function fetchTaskLists(token: string) {
  const response = await fetchWithRetry(
    'https://tasks.googleapis.com/tasks/v1/users/@me/lists',
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await response.json();
  return data.items || [];
}

export async function fetchTasks(token: string, tasklistId: string) {
  const response = await fetchWithRetry(
    `https://tasks.googleapis.com/tasks/v1/lists/${tasklistId}/tasks?showCompleted=false`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await response.json();
  return data.items || [];
}

export async function createGoogleTask(token: string, tasklistId: string, title: string, notes: string) {
  const response = await fetchWithRetry(
    `https://tasks.googleapis.com/tasks/v1/lists/${tasklistId}/tasks`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title,
        notes,
      })
    }
  );
  return response.json();
}

export async function updateGoogleTask(token: string, tasklistId: string, taskId: string, status: string) {
  const response = await fetchWithRetry(
    `https://tasks.googleapis.com/tasks/v1/lists/${tasklistId}/tasks/${taskId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    }
  );
  return response.json();
}

