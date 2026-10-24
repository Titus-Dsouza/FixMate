#!/usr/bin/env python
"""Command-line entry point for Django management commands."""

import os
import sys


def main():
    """Run a Django management command using the project's settings."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Django could not be imported. Install backend/requirements.txt "
            "in your active Python environment."
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
