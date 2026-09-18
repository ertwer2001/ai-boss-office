import unittest
from uuid import uuid4
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from budget import Budget


class BudgetTests(unittest.TestCase):
    def test_actual_langchain_callback_aborts_before_model(self):
        budget = Budget(1)
        model = FakeListChatModel(responses=["first", "second"], callbacks=[budget])
        self.assertEqual(model.invoke("test").content, "first")
        with self.assertRaisesRegex(RuntimeError, "budget reached"):
            model.invoke("test")
        self.assertEqual(model.i, 1)
        self.assertEqual(budget.calls, 1)

    def test_duplicate_callback_does_not_double_charge(self):
        budget = Budget(1)
        run = uuid4()
        budget.reserve(run)
        budget.reserve(run)
        self.assertEqual(budget.calls, 1)


if __name__ == "__main__":
    unittest.main()
