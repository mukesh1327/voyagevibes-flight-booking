import { useMemo, useState } from 'react';
import { Activity, ArrowRight, CheckCircle2, Database, Loader2, RadioTower, Server, XCircle } from 'lucide-react';

import { injectTraceHeaders, runDemoClickTrace } from './telemetry.js';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const SESSION_STORAGE_KEY = 'makara-demo-session-id';

const getSessionId = () => {
  const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (stored) {
    return stored;
  }

  const sessionId = crypto.randomUUID();
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  return sessionId;
};

function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const sessionId = useMemo(getSessionId, []);

  const runDemo = async () => {
    setLoading(true);
    setError(null);

    try {
      const responsePayload = await runDemoClickTrace(async (span) => {
        span.setAttribute('demo.session_id', sessionId);
        span.setAttribute('demo.button_name', 'Collect complete trace');

        const headers = new Headers({
          'Content-Type': 'application/json',
        });
        injectTraceHeaders(headers);

        const response = await fetch(`${API_BASE_URL}/demo/button-click`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            sessionId,
            buttonName: 'Collect complete trace',
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(body || `Demo request failed with HTTP ${response.status}`);
        }

        const json = await response.json();
        span.setAttribute('demo.event_id', json.eventId);
        span.setAttribute('demo.backend_trace_id', json.traceId);
        return json;
      });

      setResult(responsePayload);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="demo-shell">
      <section className="demo-hero">
        <div className="brand-row">
          <Activity size={24} />
          <span>Makara Observer Demo</span>
        </div>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">VoyageVibes trace lab</p>
            <h1>Click once. Follow the whole request.</h1>
            <p className="hero-text">
              This demo emits a browser span, sends the request through Kong Gateway,
              propagates trace context to Spring Boot, writes a row to the database,
              reads the event count, and returns the same evidence back to the browser.
            </p>

            <button className="primary-action" type="button" onClick={runDemo} disabled={loading}>
              {loading ? <Loader2 className="spin" size={20} /> : <Activity size={20} />}
              {loading ? 'Collecting trace...' : 'Collect complete trace'}
            </button>

            {error && (
              <div className="status-panel error-panel">
                <XCircle size={20} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="trace-card">
            <div className="trace-step active">
              <Activity size={20} />
              <div>
                <strong>Browser</strong>
                <span>Button click span and fetch request</span>
              </div>
            </div>
            <ArrowRight className="trace-arrow" size={18} />
            <div className="trace-step active">
              <RadioTower size={20} />
              <div>
                <strong>Kong Gateway</strong>
                <span>Only gateway route to the demo backend API</span>
              </div>
            </div>
            <ArrowRight className="trace-arrow" size={18} />
            <div className="trace-step active">
              <Server size={20} />
              <div>
                <strong>Backend</strong>
                <span>Spring Boot receives propagated trace context</span>
              </div>
            </div>
            <ArrowRight className="trace-arrow" size={18} />
            <div className="trace-step active">
              <Database size={20} />
              <div>
                <strong>Database</strong>
                <span>Insert plus count query recorded as child spans</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="result-grid">
        <div className="panel">
          <h2>Latest Response</h2>
          {result ? (
            <div className="response-list">
              <div>
                <span>Trace ID</span>
                <code>{result.traceId}</code>
              </div>
              <div>
                <span>Database Event ID</span>
                <code>{result.eventId}</code>
              </div>
              <div>
                <span>Total DB Events</span>
                <strong>{result.totalEvents}</strong>
              </div>
              <div>
                <span>Round Trip Message</span>
                <p>{result.message}</p>
              </div>
            </div>
          ) : (
            <p className="empty-state">Run the demo to collect the first trace and database response.</p>
          )}
        </div>

        <div className="panel">
          <h2>What Makara Should Show</h2>
          <div className="check-row">
            <CheckCircle2 size={18} />
            <span>Frontend service: <code>voyagevibes-ui</code></span>
          </div>
          <div className="check-row">
            <CheckCircle2 size={18} />
            <span>Gateway route: <code>/api/v1/demo/button-click</code> through Kong</span>
          </div>
          <div className="check-row">
            <CheckCircle2 size={18} />
            <span>Backend service: <code>authservice</code></span>
          </div>
          <div className="check-row">
            <CheckCircle2 size={18} />
            <span>Operations: browser click, HTTP POST, backend receive, DB insert, DB count</span>
          </div>
          <div className="check-row">
            <CheckCircle2 size={18} />
            <span>Search by returned trace ID after clicking the button.</span>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
