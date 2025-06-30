"""
Simple test file to debug test execution issues.
"""
import unittest
import sys

class SimpleTest(unittest.TestCase):
    def test_print_output(self):
        print("This is a test output message")
        self.assertTrue(True)
        
    def test_another_simple_test(self):
        print("Running another simple test")
        self.assertEqual(1+1, 2)

if __name__ == "__main__":
    unittest.main(verbosity=2)
