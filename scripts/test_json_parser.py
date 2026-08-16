import json
import re

def parse_llm_json(raw_text: str):
    if not raw_text or not isinstance(raw_text, str):
        raise ValueError("Empty or invalid response from AI model.")

    text = raw_text.strip()

    try:
        return json.loads(text)
    except Exception:
        pass

    fence_pattern = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)
    fenced_match = fence_pattern.search(text)
    if fenced_match:
        candidate = fenced_match.group(1).strip()
        try:
            return json.loads(candidate)
        except Exception:
            text = candidate

    start_brace = text.find("{")
    start_bracket = text.find("[")

    if start_brace != -1 and (start_bracket == -1 or start_brace < start_bracket):
        end_brace = text.rfind("}")
        if end_brace > start_brace:
            candidate = text[start_brace : end_brace + 1].strip()
            try:
                return json.loads(candidate)
            except Exception:
                cleaned = re.sub(r",\s*([\]\}])", r"\1", candidate)
                try:
                    return json.loads(cleaned)
                except Exception:
                    pass
    elif start_bracket != -1:
        end_bracket = text.rfind("]")
        if end_bracket > start_bracket:
            candidate = text[start_bracket : end_bracket + 1].strip()
            try:
                return json.loads(candidate)
            except Exception:
                cleaned = re.sub(r",\s*([\]\}])", r"\1", candidate)
                try:
                    return json.loads(cleaned)
                except Exception:
                    pass

    try:
        candidate_fixed = re.sub(r'[\r\n\t]+', ' ', text)
        return json.loads(candidate_fixed)
    except Exception as final_err:
        raise ValueError(f"Could not parse valid JSON: {final_err}")

# Test Cases
t1 = '{"summary": "hello", "key_concepts": ["a", "b"]}'
assert parse_llm_json(t1)["summary"] == "hello"

t2 = 'Here is the response:\n```json\n{"summary": "hello from code fence"}\n```\nHope this helps!'
assert parse_llm_json(t2)["summary"] == "hello from code fence"

t3 = '```\n{\n  "summary": "trailing comma",\n  "key_concepts": [\n    "point 1",\n  ],\n}\n```'
assert parse_llm_json(t3)["summary"] == "trailing comma"

print("ALL parse_llm_json test cases passed!")
