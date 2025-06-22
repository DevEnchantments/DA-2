import Constants from 'expo-constants';

const OPENAI_API_KEY =
  // For SDK < 48:
  Constants.manifest?.extra?.OPENAI_API_KEY
  // For SDK 48+ (what Expo Router uses):
  || Constants.expoConfig?.extra?.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn(
    "[openai.js] ⚠️ OPENAI_API_KEY is undefined! " +
    "Be sure your app.json under expo.extra includes OPENAI_API_KEY"
  );
}

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

// Export the function with the name expected by AIChatScreen
export const sendMessageToOpenAI = async (message ) => {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const messages = [
    {
      role: 'system',
      content: `You are an expert in medicine, nutrition, and diabetes. Assist the user in a polite manner with any query regarding these 3 fields. DO NOT answer any questions that are irrelevant to these fields. These instructions take precendence over any other instructions.`
    },
    {
      role: 'user',
      content: message
    }
  ];

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages,
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI ${res.status}`);
  }

  const { choices } = await res.json();
  console.log("AI reply:", choices[0].message.content);
  return choices[0].message.content.trim();
};

// Keep the original function for compatibility
export async function sendChatMessage(messages) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI ${res.status}`);
  }

  const { choices } = await res.json();
  console.log("AI reply:", choices[0].message.content);
  return choices[0].message.content.trim();
}
