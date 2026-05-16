"""Test Pydantic v2 serialization of ArticleCategoriesResponse"""
import sys
sys.path.insert(0, 'D:\\DeepSeek-Work\\backend')
from schemas import ArticleCategoriesResponse, CategoryCount

r = ArticleCategoriesResponse(
    by_source=[CategoryCount(name="test", count=1)],
    by_action=[CategoryCount(name="read", count=5)],
    by_status=[CategoryCount(name="new", count=10)],
    by_domain=[CategoryCount(name="AI", count=3)],
    total=10,
    unread=5,
)

# Test model_dump
d = r.model_dump()
print("model_dump keys:", sorted(d.keys()))
print("by_domain in d:", "by_domain" in d)
print("schema_version in d:", "schema_version" in d)

# Test model_dump with various options
d2 = r.model_dump(exclude_unset=True)
print("exclude_unset keys:", sorted(d2.keys()))

d3 = r.model_dump(exclude_defaults=True)
print("exclude_defaults keys:", sorted(d3.keys()))
