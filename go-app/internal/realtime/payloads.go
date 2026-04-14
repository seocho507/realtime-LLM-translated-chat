package realtime

import "reflect"

func ToPayload(eventType string, fields map[string]any) map[string]any {
	payload := map[string]any{"t": eventType}
	for k, v := range fields {
		if shouldInclude(v) {
			payload[k] = v
		}
	}
	return payload
}

func shouldInclude(value any) bool {
	if value == nil {
		return false
	}
	rv := reflect.ValueOf(value)
	switch rv.Kind() {
	case reflect.Pointer, reflect.Interface, reflect.Map, reflect.Slice:
		return !rv.IsNil()
	default:
		return true
	}
}
