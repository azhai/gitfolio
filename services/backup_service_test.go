package services

import "testing"

func TestLibpqBackupDSN(t *testing.T) {
	cases := []struct {
		name string
		dsn  string
		want string
	}{
		{
			name: "去掉驱动专用的 search_path",
			dsn:  "postgres://dba:secret@127.0.0.1:5432/test?search_path=folio,public&sslmode=disable",
			want: "postgres://dba:secret@127.0.0.1:5432/test?sslmode=disable",
		},
		{
			name: "只有 search_path 时清空查询串",
			dsn:  "postgres://dba:secret@localhost:5432/app?search_path=folio",
			want: "postgres://dba:secret@localhost:5432/app",
		},
		{
			name: "原样保留没有 search_path 的连接串",
			dsn:  "postgres://dba:secret@localhost:5432/app?sslmode=require",
			want: "postgres://dba:secret@localhost:5432/app?sslmode=require",
		},
		{
			name: "原样保留 sqlite 路径",
			dsn:  "./data/folio.db",
			want: "./data/folio.db",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := libpqBackupDSN(tc.dsn); got != tc.want {
				t.Errorf("libpqBackupDSN(%q) = %q, want %q", tc.dsn, got, tc.want)
			}
		})
	}
}
