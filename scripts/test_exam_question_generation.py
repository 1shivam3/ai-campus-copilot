import os
import sys
from dotenv import load_dotenv

# Set PYTHONPATH and load env
backend_path = os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.insert(0, backend_path)
load_dotenv(os.path.join(backend_path, ".env"))

from main import generate_exam_question, ExamQuestionRequest

def run_tests():
    print("=======================================================")
    print("      EXAM QUESTION GENERATION VERIFICATION AUDIT      ")
    print("=======================================================")

    # Test 1: Theory MCQ (Data Structures, Unit 1 & Unit 3)
    print("\n[TEST 1/5] Theory MCQ Generation (Data Structures, Units 1 & 3)...")
    req1 = ExamQuestionRequest(
        subject_name="Data Structure and Algorithms",
        syllabus_type="theory",
        question_type="mcq",
        selected_units=["Unit 1", "Unit 3"],
        difficulty="medium",
        answer_mode="question_only",
        used_questions=[]
    )
    res1 = generate_exam_question(req1)
    q1 = res1.get("question", {})
    print(f"  * Unit Scope:      {q1.get('unit')}")
    print(f"  * Question Type:   {q1.get('question_type')}")
    print(f"  * Question:        {q1.get('question')}")
    print(f"  * Options Count:   {len(q1.get('options', []))}")
    print(f"  * Correct Index:   {q1.get('correct_answer')}")
    print(f"  * Explanation:     {q1.get('explanation')[:80]}...")
    assert q1.get("question_type") == "mcq"
    assert len(q1.get("options", [])) == 4
    assert q1.get("correct_answer") in [0, 1, 2, 3]
    print("  --> [PASS] Theory MCQ generated successfully.")

    # Test 2: Theory Short Answer (Data Structures, Unit 2)
    print("\n[TEST 2/5] Theory Short Answer Generation (Data Structures, Unit 2)...")
    req2 = ExamQuestionRequest(
        subject_name="Data Structure and Algorithms",
        syllabus_type="theory",
        question_type="short_answer",
        selected_units=["Unit 2"],
        difficulty="hard",
        answer_mode="question_only",
        used_questions=[q1.get("question")]
    )
    res2 = generate_exam_question(req2)
    q2 = res2.get("question", {})
    print(f"  * Unit Scope:      {q2.get('unit')}")
    print(f"  * Question Type:   {q2.get('question_type')}")
    print(f"  * Question:        {q2.get('question')}")
    print(f"  * Expected Answer: {q2.get('expected_answer')[:80]}...")
    print(f"  * Key Points:      {q2.get('key_points')}")
    assert q2.get("question_type") == "short_answer"
    assert q2.get("expected_answer")
    assert len(q2.get("key_points", [])) >= 2
    print("  --> [PASS] Theory Short Answer generated successfully.")

    # Test 3: Theory Long Answer (Data Structures, Unit 4)
    print("\n[TEST 3/5] Theory Long Answer Generation (Data Structures, Unit 4)...")
    req3 = ExamQuestionRequest(
        subject_name="Data Structure and Algorithms",
        syllabus_type="theory",
        question_type="long_answer",
        selected_units=["Unit 4"],
        difficulty="mixed",
        answer_mode="question_and_answer",
        used_questions=[q1.get("question"), q2.get("question")]
    )
    res3 = generate_exam_question(req3)
    q3 = res3.get("question", {})
    print(f"  * Unit Scope:      {q3.get('unit')}")
    print(f"  * Question Type:   {q3.get('question_type')}")
    print(f"  * Question:        {q3.get('question')}")
    print(f"  * Key Criteria:    {len(q3.get('key_points', []))} points")
    assert q3.get("question_type") == "long_answer"
    assert q3.get("expected_answer")
    print("  --> [PASS] Theory Long Answer generated successfully.")

    # Test 4: Lab Subject Practicals (BCSE-501L, Practicals 1, 3, 7)
    print("\n[TEST 4/5] Lab Practical Question Generation (Data Structures Lab)...")
    req4 = ExamQuestionRequest(
        subject_name="Data Structure and Algorithms Lab",
        syllabus_type="lab",
        question_type="mcq",
        selected_units=["Practical 1", "Practical 3", "Practical 7"],
        difficulty="medium",
        answer_mode="question_only",
        used_questions=[]
    )
    res4 = generate_exam_question(req4)
    q4 = res4.get("question", {})
    print(f"  * Scope:           {q4.get('unit')}")
    print(f"  * Question:        {q4.get('question')}")
    assert "Practical" in str(q4.get("unit", ""))
    print("  --> [PASS] Lab practical question scoped correctly.")

    # Test 5: Duplicate Prevention Loop (5 consecutive questions)
    print("\n[TEST 5/5] Multi-Question Duplicate Prevention Session...")
    used = []
    for i in range(5):
        req = ExamQuestionRequest(
            subject_name="Software Engineering",
            syllabus_type="theory",
            question_type="mcq",
            selected_units=["Unit 1", "Unit 2", "Unit 3", "Unit 4"],
            difficulty="mixed",
            answer_mode="question_only",
            used_questions=used
        )
        res = generate_exam_question(req)
        q_text = res["question"]["question"].strip()
        print(f"  * Q{i+1}: {q_text[:70]}... ({res['question']['unit']})")
        assert q_text not in used, f"Duplicate question detected: {q_text}"
        used.append(q_text)
    print(f"  --> [PASS] 5 distinct questions generated with 0 duplicates.")

    print("\n=======================================================")
    print(" ALL EXAM GENERATION TESTS PASSED (100% SUCCESS) ")
    print("=======================================================")

if __name__ == "__main__":
    run_tests()
