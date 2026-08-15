// Helper for exponential backoff retry
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, backoff = 500): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (response.ok) return response;
    
    // Retry on 429 (Rate Limit) or 5xx server errors
    if ((response.status === 429 || response.status >= 500) && retries > 0) {
      await new Promise(res => setTimeout(res, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  } catch (error) {
    if (retries > 0) {
      await new Promise(res => setTimeout(res, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
}

export async function fetchCalendarEvents(token: string) {
  const timeMin = new Date();
  timeMin.setHours(0, 0, 0, 0); // Start of today
  const timeMax = new Date();
  timeMax.setHours(23, 59, 59, 999); // End of today

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
