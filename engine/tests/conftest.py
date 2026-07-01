"""Config pytest : garantit que `app` et `contract` sont importables."""

import os
import sys

ENGINE_DIR = os.path.dirname(os.path.dirname(__file__))
TESTS_DIR = os.path.dirname(__file__)
for p in (ENGINE_DIR, TESTS_DIR):
    if p not in sys.path:
        sys.path.insert(0, p)
