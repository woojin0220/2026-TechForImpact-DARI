import json
from pathlib import Path
from urllib.parse import urlparse
import unittest


SCHEMA_DIR = Path(__file__).parents[1] / "schemas"


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def resolve_pointer(document, fragment):
    current = document
    if not fragment:
        return current
    if not fragment.startswith("/"):
        raise AssertionError(f"unsupported JSON pointer: #{fragment}")
    for token in fragment[1:].split("/"):
        token = token.replace("~1", "/").replace("~0", "~")
        current = current[token]
    return current


class SchemaArtifactTests(unittest.TestCase):
    def test_schema_ids_match_filenames_and_all_refs_resolve(self):
        schemas = {
            path.name: json.loads(path.read_text(encoding="utf-8"))
            for path in SCHEMA_DIR.glob("*.json")
        }
        self.assertEqual(set(schemas), {"input.schema.json", "report.schema.json", "fixture.schema.json"})
        by_id = {schema["$id"]: schema for schema in schemas.values()}
        self.assertEqual(len(by_id), len(schemas))

        for filename, schema in schemas.items():
            self.assertEqual(urlparse(schema["$id"]).path.rsplit("/", 1)[-1], filename)
            for node in walk(schema):
                reference = node.get("$ref")
                if not reference:
                    continue
                resource, separator, fragment = reference.partition("#")
                if not resource:
                    target = schema
                else:
                    target_name = urlparse(resource).path.rsplit("/", 1)[-1]
                    self.assertIn(target_name, schemas, reference)
                    target = schemas[target_name]
                if separator:
                    resolve_pointer(target, fragment)


if __name__ == "__main__":
    unittest.main()
