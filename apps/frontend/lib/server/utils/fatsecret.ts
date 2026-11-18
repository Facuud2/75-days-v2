import axios from 'axios';

let currentToken: string | null = null;
let tokenExpiry = 0;

async function getFatSecretToken(): Promise<string> {
  if (currentToken && Date.now() < tokenExpiry) {
    return currentToken;
  }

  const clientId = process.env.FATSECRET_CLIENT_ID;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('FATSECRET_CLIENT_ID or FATSECRET_CLIENT_SECRET is missing');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('scope', 'basic');

  const res = await axios.post<{ access_token: string; expires_in: number }>(
    'https://oauth.fatsecret.com/connect/token',
    params.toString(),
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  currentToken = res.data.access_token;
  tokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000;

  return currentToken;
}

export async function searchFoods(query: string, pageNumber: number = 0) {
  const token = await getFatSecretToken();

  const res = await axios.get('https://platform.fatsecret.com/rest/server.api', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      method: 'foods.search',
      search_expression: query,
      format: 'json',
      page_number: pageNumber,
      max_results: 10,
    },
  });

  return res.data;
}

export async function getFoodDetails(foodId: string) {
  const token = await getFatSecretToken();

  const res = await axios.get('https://platform.fatsecret.com/rest/server.api', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      method: 'food.get.v3',
      food_id: foodId,
      format: 'json',
    },
  });

  return res.data;
}
