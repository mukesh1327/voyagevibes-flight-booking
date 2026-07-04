# VoyageVibes UI

React + Vite frontend for the VoyageVibes flight booking app.

## Local Development

```sh
npm install
npm run dev
```

The dev server runs on port `9001`. API calls under `/api/v1/auth` are proxied to the local auth service at `http://localhost:8081/auth`; other `/api` calls go through Kong at `http://localhost:8000`.

## Auth Flow

- Customer users sign in with Google through Keycloak.
- Corporate users sign in through the configured corporate Keycloak flow.
- The callback page exchanges the authorization code with the auth service and stores the returned tokens in session storage.
