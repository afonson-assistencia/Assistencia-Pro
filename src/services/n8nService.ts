export async function sendToN8N(payload: any) {
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('N8N_WEBHOOK_URL not configured');
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`N8N request failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending to n8n:', error);
    throw error;
  }
}
