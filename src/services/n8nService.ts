export async function sendToN8N(payload: any) {
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
  
  if (!webhookUrl || webhookUrl.trim() === '') {
    console.warn('N8N_WEBHOOK_URL not configured. Skipping integration.');
    return { skipped: true, reason: 'N8N_WEBHOOK_URL not configured' };
  }

  try {
    // Basic URL validation
    new URL(webhookUrl);
  } catch (e) {
    const msg = `Invalid N8N_WEBHOOK_URL: ${webhookUrl}`;
    console.error(msg);
    throw new Error(msg);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorDetail = '';
      try {
        const errorData = await response.json();
        errorDetail = JSON.stringify(errorData);
      } catch (e) {
        errorDetail = await response.text();
      }
      
      const errorMessage = `N8N request failed with status ${response.status} (${response.statusText || 'No status text'}). Detail: ${errorDetail.slice(0, 200)}`;
      throw new Error(errorMessage);
    }

    // Some webhooks might return 204 No Content or empty body
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      return { success: true, status: response.status };
    }
  } catch (error: any) {
    let finalError: Error;
    if (error.name === 'AbortError') {
      finalError = new Error('N8N request timed out after 10 seconds');
    } else if (error instanceof TypeError && error.message === 'Failed to fetch') {
      finalError = new Error(`N8N connection failed. Check if the URL is accessible and CORS is allowed: ${webhookUrl}`);
    } else {
      finalError = error instanceof Error ? error : new Error(String(error));
    }

    console.error('Error sending to n8n:', finalError.message);
    throw finalError;
  }
}
