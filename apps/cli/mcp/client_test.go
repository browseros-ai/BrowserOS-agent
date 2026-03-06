package mcp

import "testing"

func TestExtractPageID(t *testing.T) {
	tests := []struct {
		name string
		data map[string]any
		want int
		ok   bool
	}{
		{
			name: "nested page object",
			data: map[string]any{
				"page": map[string]any{
					"pageId": float64(7),
				},
			},
			want: 7,
			ok:   true,
		},
		{
			name: "top level page id",
			data: map[string]any{
				"pageId": float64(3),
			},
			want: 3,
			ok:   true,
		},
		{
			name: "nested int page id",
			data: map[string]any{
				"page": map[string]any{
					"pageId": 11,
				},
			},
			want: 11,
			ok:   true,
		},
		{
			name: "missing page id",
			data: map[string]any{
				"page": map[string]any{
					"tabId": float64(9),
				},
			},
			ok: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := extractPageID(tt.data)
			if ok != tt.ok {
				t.Fatalf("extractPageID() ok = %v, want %v", ok, tt.ok)
			}
			if got != tt.want {
				t.Fatalf("extractPageID() = %d, want %d", got, tt.want)
			}
		})
	}
}
