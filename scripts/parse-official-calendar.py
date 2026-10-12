#!/usr/bin/env python3
"""Bounded JSON-only CLI. Full evidence belongs in the protected artifact spool."""

import json
import sys
from official_calendar.official_pdf import ParseError, parse_pdf

if __name__ == "__main__":
    try:
        import resource

        resource.setrlimit(resource.RLIMIT_CPU, (50, 50))
        resource.setrlimit(resource.RLIMIT_AS, (2 * 1024**3, 2 * 1024**3))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        if len(sys.argv) != 3:
            raise ParseError("INVALID_ARGUMENTS")
        result = parse_pdf(sys.argv[1], int(sys.argv[2]))
        print(json.dumps(result, ensure_ascii=False))
    except Exception as error:
        code = str(error) if isinstance(error, ParseError) else "PDF_EXTRACTION_FAILED"
        print(json.dumps({"error": code, "parserVerified": False}))
        sys.exit(1)
