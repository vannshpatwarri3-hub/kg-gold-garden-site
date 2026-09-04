"""Small command-line utilities for working with text."""
import sys


def count_words(text):
    return len(text.split())


def count_unique_words(text):
    return len(set(text.lower().split()))


def main():
    if len(sys.argv) != 3:
        print("Usage: python word_tools.py <count|unique> <path/to/file.txt>")
        sys.exit(1)

    command, path = sys.argv[1], sys.argv[2]
    with open(path, encoding="utf-8") as f:
        text = f.read()

    if command == "count":
        print(count_words(text))
    elif command == "unique":
        print(count_unique_words(text))
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
