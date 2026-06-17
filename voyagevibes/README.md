# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## OpenTelemetry

Browser telemetry is disabled by default. Copy `.env.example` to `.env.local` and set:

```env
VITE_OTEL_ENABLED=true
VITE_OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

When enabled, the UI exports:

- traces for route and fetch instrumentation
- logs for console output and unhandled browser errors
- metrics for bootstrap timing and browser error counts

Keep `VITE_OTEL_PROPAGATE_TRACE_HEADERS=false` unless the target API explicitly allows `traceparent`/`tracestate` CORS headers.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
