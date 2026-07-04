export const getFrontendConfig = async () => {
  const response = await fetch('/api/v1/auth/frontend-config');
  if (!response.ok) {
    throw new Error(`Failed to fetch frontend config: ${response.status}`);
  }
  return response.json();
};

export const getCurrentUser = async (token) => {
  const response = await fetch('/api/v1/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Token expired or invalid');
    }
    throw new Error(`Failed to get current user: ${response.status}`);
  }

  return response.json();
};

const authStorage = window.sessionStorage;
const legacyAuthStorage = window.localStorage;
const AUTH_CONTINUE_PARAM = 'continueAuth';

export const getStoredToken = () => {
  const token = authStorage.getItem('access_token') || legacyAuthStorage.getItem('access_token');
  const refreshToken = authStorage.getItem('refresh_token') || legacyAuthStorage.getItem('refresh_token');

  legacyAuthStorage.removeItem('access_token');
  legacyAuthStorage.removeItem('refresh_token');

  if (token) {
    authStorage.setItem('access_token', token);
  }
  if (refreshToken) {
    authStorage.setItem('refresh_token', refreshToken);
  }

  return token;
};

export const storeTokens = ({ accessToken, refreshToken }) => {
  if (accessToken) {
    authStorage.setItem('access_token', accessToken);
  }
  if (refreshToken) {
    authStorage.setItem('refresh_token', refreshToken);
  }
};

export const clearStoredAuth = () => {
  authStorage.removeItem('access_token');
  authStorage.removeItem('refresh_token');
  authStorage.removeItem('auth_state');
  authStorage.removeItem('auth_verifier');
  authStorage.removeItem('auth_type');
  authStorage.removeItem('auth_redirect_uri');
  legacyAuthStorage.removeItem('access_token');
  legacyAuthStorage.removeItem('refresh_token');
};

export const generateRandomString = (length = 43) => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let randomString = '';
  const randomValues = new Uint32Array(length);
  window.crypto.getRandomValues(randomValues);

  for (let i = 0; i < length; i += 1) {
    randomString += charset[randomValues[i] % charset.length];
  }

  return randomString;
};

export const generateCodeChallenge = async (codeVerifier) => {
  if (!window.crypto?.subtle) {
    throw new Error('Secure login requires HTTPS, or localhost for local development.');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);

  return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export const startLoginFlow = async (type = 'customer', config, options = {}) => {
  const authConfig = config || await getFrontendConfig();

  if (!options.skipSsoClear) {
    clearStoredAuth();
    const returnUrl = new URL('/login', window.location.origin);
    returnUrl.searchParams.set(AUTH_CONTINUE_PARAM, type);

    const logoutUrl = new URL(authConfig.logoutEndpoint);
    logoutUrl.searchParams.set('client_id', authConfig.clientId);
    logoutUrl.searchParams.set('post_logout_redirect_uri', returnUrl.toString());
    window.location.href = logoutUrl.toString();
    return;
  }

  const state = generateRandomString();
  const nonce = generateRandomString();
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  authStorage.setItem('auth_state', state);
  authStorage.setItem('auth_verifier', codeVerifier);
  authStorage.setItem('auth_type', type);

  const redirectUri = `${window.location.origin}/callback`;
  authStorage.setItem('auth_redirect_uri', redirectUri);

  let endpoint = authConfig.authorizationEndpoint;
  if (endpoint.includes('//keycloak:8080')) {
    endpoint = endpoint.replace('//keycloak:8080', '//localhost:8090');
  }

  const authUrl = new URL(endpoint);
  authUrl.searchParams.set('client_id', authConfig.clientId);
  authUrl.searchParams.set('response_type', authConfig.responseType);
  authUrl.searchParams.set('scope', authConfig.scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('nonce', nonce);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', authConfig.codeChallengeMethod || 'S256');
  authUrl.searchParams.set('redirect_uri', redirectUri);

  const typeConfig = authConfig[type];
  if (typeConfig?.authorizationParameters) {
    Object.entries(typeConfig.authorizationParameters).forEach(([key, value]) => {
      authUrl.searchParams.set(key, value);
    });
  }

  if (typeConfig?.identityProviderHint) {
    authUrl.searchParams.set('kc_idp_hint', typeConfig.identityProviderHint);
  }

  authUrl.searchParams.set('prompt', 'login');
  window.location.href = authUrl.toString();
};

export const readPendingLoginType = () => {
  const params = new URLSearchParams(window.location.search);
  const type = params.get(AUTH_CONTINUE_PARAM);

  if (type !== 'customer' && type !== 'corporate') {
    return null;
  }

  params.delete(AUTH_CONTINUE_PARAM);
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', nextUrl);
  return type;
};

export const handleCallback = async (code, state) => {
  const savedState = authStorage.getItem('auth_state');
  const codeVerifier = authStorage.getItem('auth_verifier');
  const type = authStorage.getItem('auth_type');

  if (state !== savedState) {
    throw new Error('State mismatch');
  }

  const storedRedirectUri = authStorage.getItem('auth_redirect_uri');
  const redirectUri = storedRedirectUri || `${window.location.origin}/callback`;
  const endpoint = type === 'customer' ? '/api/v1/auth/customer/login' : '/api/v1/auth/corporate/login';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      authorizationCode: code,
      redirectUri,
      codeVerifier,
    }),
  });

  if (!response.ok) {
    let message = `Login failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      message = errorBody.message || errorBody.error || message;
    } catch {
      const errorText = await response.text();
      message = errorText || message;
    }
    throw new Error(message);
  }

  const data = await response.json();
  authStorage.removeItem('auth_state');
  authStorage.removeItem('auth_verifier');
  authStorage.removeItem('auth_type');
  authStorage.removeItem('auth_redirect_uri');

  return data;
};

export const readOAuthCallbackError = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');
  const errorDescription = urlParams.get('error_description');

  if (!error) {
    return null;
  }

  return errorDescription ? `${error}: ${errorDescription}` : error;
};
