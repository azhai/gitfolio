package models

import (
	"reflect"
	"testing"
	"time"

	"github.com/azhai/goent/utils"
)

type stamper interface {
	Stamp()
}

type tableEntry struct {
	model reflect.Type
	table string
}

// schemaTables 遍历 FolioSchema 上的每个 goent.Table[X]，返回 X 的模型类型和表名。
// goent 用 ToSnakeCase(模型名) 推导表名，这里保持一致。
func schemaTables() []tableEntry {
	schema := reflect.TypeOf(FolioSchema{})
	out := make([]tableEntry, 0, schema.NumField())
	for i := range schema.NumField() {
		tbl := schema.Field(i).Type.Elem()
		field, ok := tbl.FieldByName("Model")
		if !ok {
			panic("goent.Table at FolioSchema." + schema.Field(i).Name + " has no Model field")
		}
		model := field.Type.Elem()
		out = append(out, tableEntry{model, utils.ToSnakeCase(model.Name())})
	}
	return out
}

func timestampedTables() []tableEntry {
	var out []tableEntry
	for _, entry := range schemaTables() {
		if f, ok := fieldOf(entry.model, "CreatedAt"); ok && f.Type == reflect.TypeOf(time.Time{}) {
			out = append(out, entry)
		}
	}
	return out
}

// 有 created_at 列却没有 Stamp() 的模型，插入后会落成 0001-01-01。
func TestTimestampedModelsImplementStamp(t *testing.T) {
	iface := reflect.TypeOf((*stamper)(nil)).Elem()
	for _, entry := range timestampedTables() {
		if !reflect.PointerTo(entry.model).Implements(iface) {
			t.Errorf("%s has created_at but no Stamp() method — add it to timestamps.go", entry.model.Name())
		}
	}
}

// Stamp() 覆盖不到的表，回填也覆盖不到，界面上会一直显示 “-”。
func TestTimestampedTablesAreBackfillTargets(t *testing.T) {
	columns := map[string][]string{}
	for _, target := range timestampBackfillTargets {
		columns[target.table] = target.columns
	}
	for _, entry := range timestampedTables() {
		want := []string{"created_at"}
		if _, ok := fieldOf(entry.model, "UpdatedAt"); ok {
			want = append(want, "updated_at")
		}
		got, ok := columns[entry.table]
		if !ok {
			t.Errorf("table %s (%s) has timestamps but is not a backfill target", entry.table, entry.model.Name())
			continue
		}
		for _, column := range want {
			if !contains(got, column) {
				t.Errorf("table %s is a backfill target but misses column %s", entry.table, column)
			}
		}
	}
}

func TestStamp_FillsZeroAndKeepsSetValues(t *testing.T) {
	remote := time.Date(2001, 2, 3, 4, 5, 6, 0, time.UTC)

	issue := &Issue{CreatedAt: remote}
	issue.Stamp()
	if !issue.CreatedAt.Equal(remote) {
		t.Errorf("Stamp() overwrote an existing created_at: %v", issue.CreatedAt)
	}
	if issue.UpdatedAt.IsZero() {
		t.Error("Stamp() left updated_at zero")
	}

	transition := &TaskTransition{}
	transition.Stamp()
	if transition.CreatedAt.IsZero() {
		t.Error("Stamp() left TaskTransition.CreatedAt zero")
	}

	// 只有 created_at 的表也一样要填上。
	log := &GitCommandLog{}
	log.Stamp()
	if log.CreatedAt.IsZero() {
		t.Error("Stamp() left GitCommandLog.CreatedAt zero")
	}
}

// 时间列是 timestamp without time zone，驱动按 UTC 读回、界面再转东八区，
// 所以入库的墙钟必须是 UTC；写成局部时间会让界面多出 8 小时。
func TestStamp_WritesUTC(t *testing.T) {
	repo := &Repository{}
	repo.Stamp()

	_, offset := repo.CreatedAt.Zone()
	if offset != 0 {
		t.Errorf("Stamp() wrote created_at with zone offset %d, want UTC", offset)
	}
	if diff := time.Now().UTC().Sub(repo.CreatedAt); diff < 0 || diff > time.Minute {
		t.Errorf("Stamp() created_at is %v from UTC now, want within a minute", diff)
	}
}

// fieldOf 返回字段和它是否存在，避免 reflect.Type.FieldByName 的双返回值在单值上下文里报错。
func fieldOf(model reflect.Type, name string) (reflect.StructField, bool) {
	f, ok := model.FieldByName(name)
	return f, ok && f.Type != reflect.TypeOf((*time.Duration)(nil)).Elem()
}

func contains(haystack []string, needle string) bool {
	for _, s := range haystack {
		if s == needle {
			return true
		}
	}
	return false
}
