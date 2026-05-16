"""Quick test for schema"""
import sys
sys.path.insert(0, 'D:\\DeepSeek-Work\\backend')
from schemas import ArticleCategoriesResponse, CategoryCount

r = ArticleCategoriesResponse(by_source=[], by_action=[], by_status=[], total=0, unread=0)
d = r.model_dump()
print('has by_domain:', 'by_domain' in d)
print('by_domain value:', d.get('by_domain'))
