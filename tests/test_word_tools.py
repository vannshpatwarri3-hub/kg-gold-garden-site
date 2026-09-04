import unittest

from word_tools import count_words, count_unique_words


class WordToolsTest(unittest.TestCase):
    def test_count_words(self):
        self.assertEqual(count_words("one two three"), 3)

    def test_count_unique_words(self):
        self.assertEqual(count_unique_words("one two two three"), 3)

    def test_count_words_empty_string(self):
        self.assertEqual(count_words(""), 0)


if __name__ == "__main__":
    unittest.main()
