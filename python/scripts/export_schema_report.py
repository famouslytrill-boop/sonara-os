import json

from sonara_ops.migrations import schema_report


if __name__ == "__main__":
    print(json.dumps(schema_report(), indent=2))
