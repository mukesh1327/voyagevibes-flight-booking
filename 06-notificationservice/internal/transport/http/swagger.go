package transporthttp

import (
	_ "embed"
	"net/http"
)

var (
	//go:embed static/openapi.json
	openAPISpec []byte

	//go:embed static/swagger-ui.html
	swaggerUIHTML []byte
)

func registerSwaggerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/swagger", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if r.URL.Path != "/swagger" {
			http.NotFound(w, r)
			return
		}
		http.Redirect(w, r, "/swagger/", http.StatusMovedPermanently)
	})

	mux.HandleFunc("/swagger/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		switch r.URL.Path {
		case "/swagger/", "/swagger/index.html":
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write(swaggerUIHTML)
		case "/swagger/openapi.json":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write(openAPISpec)
		default:
			http.NotFound(w, r)
		}
	})
}
