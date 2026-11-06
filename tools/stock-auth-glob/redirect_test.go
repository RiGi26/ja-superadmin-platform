package stockauthglob

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/gobwas/glob"
)

type redirects struct {
	StockAdditionalRedirectPatterns []string `json:"stockAdditionalRedirectPatterns"`
	StockCallbackPaths []string `json:"stockCallbackPaths"`
}

type execution struct {
	BaselineStockRedirects []string `json:"baselineStockRedirects"`
	StockExecutionPatterns []string `json:"stockExecutionPatterns"`
	RejectedCompactPatterns []string `json:"rejectedCompactPatterns"`
}

func readJSON(t *testing.T, name string, value any) {
	t.Helper()
	data, err := os.ReadFile("../../docs/pricing/" + name)
	if err != nil { t.Fatal(err) }
	if err := json.Unmarshal(data, value); err != nil { t.Fatal(err) }
}

func TestProviderGlobRejectsMixedRanges(t *testing.T) {
	var e execution
	readJSON(t, "stock-gate-b-auth-execution-20261105.json", &e)
	if len(e.RejectedCompactPatterns) != 2 { t.Fatal("retain both rejected patterns as regression evidence") }
	for _, pattern := range e.RejectedCompactPatterns {
		_, err := glob.Compile(pattern, '.', '/')
		if err == nil || !strings.Contains(err.Error(), "expected close range character") {
			t.Fatalf("provider must reject mixed range: %v", err)
		}
	}
}

func TestRetainedAndExecutedPatternsCompile(t *testing.T) {
	var e execution
	readJSON(t, "stock-gate-b-auth-execution-20261105.json", &e)
	if len(e.BaselineStockRedirects) != 4 || len(e.StockExecutionPatterns) != 1 { t.Fatal("unexpected current allowlist") }
	for _, pattern := range append(e.BaselineStockRedirects, e.StockExecutionPatterns...) {
		if _, err := glob.Compile(pattern, '.', '/'); err != nil { t.Fatal(err) }
	}
}

func TestApprovedCallbacksMatchOnlyBoundedUUIDv4(t *testing.T) {
	var c redirects
	readJSON(t, "stock-gate-b-auth-redirects-20261105.json", &c)
	if len(c.StockAdditionalRedirectPatterns) != 2 || len(c.StockCallbackPaths) != 2 { t.Fatal("missing approved callbacks") }
	const origin = "https://webzoka-stock-platform.vercel.app"
	const uuid = "01234567-89ab-4cde-8fab-0123456789ab"
	for i, pattern := range c.StockAdditionalRedirectPatterns {
		g, err := glob.Compile(pattern, '.', '/')
		if err != nil { t.Fatal(err) }
		prefix := origin + c.StockCallbackPaths[i] + "?flow="
		if !g.Match(prefix + uuid) { t.Fatal("approved callback rejected") }
		for pos := 0; pos < len(uuid); pos++ {
			for ch := byte(0); ch < 128; ch++ {
				expected := strings.ContainsRune("0123456789abcdef", rune(ch))
				switch pos {
				case 8, 13, 18, 23: expected = ch == '-'
				case 14: expected = ch == '4'
				case 19: expected = strings.ContainsRune("89ab", rune(ch))
				}
				candidate := []byte(uuid)
				candidate[pos] = ch
				if got := g.Match(prefix + string(candidate)); got != expected {
					t.Fatalf("callback %d UUID position %d ASCII %d: got %v want %v", i, pos, ch, got, expected)
				}
			}
		}
		for _, input := range []string{
			prefix + uuid + "\n", prefix + uuid + "&next=https://foreign.test", prefix + uuid + "/extra",
			prefix + uuid[:35], prefix + uuid + "0", origin + c.StockCallbackPaths[1-i] + "?flow=" + uuid,
			"https://foreign.test" + c.StockCallbackPaths[i] + "?flow=" + uuid,
			"http://webzoka-stock-platform.vercel.app" + c.StockCallbackPaths[i] + "?flow=" + uuid,
		} {
			if g.Match(input) { t.Fatalf("unsafe callback accepted: %q", input) }
		}
	}
}
