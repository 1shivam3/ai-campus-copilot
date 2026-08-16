/**
 * CoursePilot High-Yield Social Learning Feed Catalog
 * Curated educational content matching CSE Semester 3 curriculum and verified tech developments.
 */

export const FEED_CATALOG = [
  // --- DSA & CODING CHALLENGES ---
  {
    id: "dsa-time-complexity-1",
    type: "dsa_challenge",
    category: "Challenges",
    title: "🔥 5-Minute DSA: Loop Complexity",
    subject: "Data Structures & Algorithms",
    topic: "Time Complexity & Analysis",
    difficulty: "Medium",
    xp_reward: 25,
    source: "CoursePilot Academic Engine",
    action: "Solve Challenge",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    content: "Analyze the time complexity of the following code snippet where the iterator doubles each step.",
    code_snippet: `int count = 0;
for (int i = 1; i <= n; i *= 2) {
    count++;
}`,
    interactive_type: "mcq",
    question: "What is the Big-O time complexity of this loop with respect to n?",
    options: [
      "O(n)",
      "O(log n)",
      "O(n log n)",
      "O(1)"
    ],
    correct_index: 1,
    explanation: "Because `i` multiplies by 2 on every iteration (1, 2, 4, 8, ... 2^k), the loop executes k = log2(n) times. Hence, time complexity is strictly O(log n).",
    tags: ["DSA", "Complexity", "Algorithms", "CSE-Sem3"]
  },
  {
    id: "debug-python-mutation-1",
    type: "debug_challenge",
    category: "Challenges",
    title: "🐞 Debug This: List Modification Bug",
    subject: "Python Programming",
    topic: "List Iteration & Mutation",
    difficulty: "Easy",
    xp_reward: 20,
    source: "CoursePilot Code Lab",
    action: "Debug Now",
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    content: "Why does the following code fail to remove all even numbers from the list?",
    code_snippet: `nums = [2, 4, 6, 8, 10]
for num in nums:
    if num % 2 == 0:
        nums.remove(num)
print(nums)  # Output: [4, 8]!`,
    interactive_type: "mcq",
    question: "Why are elements skipped during iteration?",
    options: [
      "The modulo operator `%` does not work in loops",
      "Mutating a list while iterating shifts indexes, skipping subsequent elements",
      "Python `remove()` deletes by index instead of value",
      "List iteration creates an immutable copy in Python 3"
    ],
    correct_index: 1,
    explanation: "When you remove an element during iteration, the underlying list shrinks and subsequent elements shift left by one index. The iterator's internal cursor advances to the next index, inadvertently skipping the shifted element.",
    tags: ["Python", "Debugging", "DataStructures"]
  },
  {
    id: "dsa-bst-property-1",
    type: "quick_challenge",
    category: "Challenges",
    title: "⚡ Quick Challenge: Binary Search Trees",
    subject: "Data Structures & Algorithms",
    topic: "Trees & Binary Search Trees",
    difficulty: "Medium",
    xp_reward: 25,
    source: "Syllabus Unit III Challenge",
    action: "Attempt Challenge",
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    content: "Which tree traversal of a valid Binary Search Tree (BST) produces keys in sorted ascending order?",
    interactive_type: "mcq",
    question: "Which tree traversal order yields strictly sorted keys in a BST?",
    options: [
      "Pre-order (Root, Left, Right)",
      "Post-order (Left, Right, Root)",
      "In-order (Left, Root, Right)",
      "Level-order (Breadth-First)"
    ],
    correct_index: 2,
    explanation: "In-order traversal visits all nodes in the left subtree (which are smaller than the root), then the root itself, then the right subtree (which are greater). This naturally produces an ascending sorted sequence.",
    tags: ["Trees", "BST", "DSA", "CSE-Sem3"]
  },

  // --- CONCEPTS & SYLLABUS BRIEFS ---
  {
    id: "concept-dbms-normalization-1",
    type: "syllabus_brief",
    category: "Learn",
    title: "📚 Syllabus Brief: Normalization in 60s",
    subject: "Database Management Systems",
    topic: "Relational Normalization & Functional Dependencies",
    difficulty: "Medium",
    xp_reward: 15,
    source: "DBMS Unit II Quick Ref",
    action: "Read Brief",
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    content: "Normalization minimizes data redundancy and avoids update, insertion, and deletion anomalies.",
    brief_markdown: `### Key Normal Forms at a Glance:
- **1NF**: Atomic values (no repeating groups or multi-valued attributes).
- **2NF**: In 1NF + No partial dependency (non-prime attributes must depend on the whole candidate key).
- **3NF**: In 2NF + No transitive dependency (non-prime attributes cannot depend on other non-prime attributes).
- **BCNF**: For every functional dependency $X \\rightarrow Y$, $X$ must be a super key.`,
    interactive_type: "mcq",
    question: "A relation is in 2NF if it is in 1NF and contains no:",
    options: [
      "Transitive dependencies",
      "Partial dependencies",
      "Multi-valued dependencies",
      "Foreign keys"
    ],
    correct_index: 1,
    explanation: "2NF eliminates partial dependencies where a non-prime attribute depends only on a proper subset of a composite primary key.",
    tags: ["DBMS", "Normalization", "Syllabus", "Exams"]
  },
  {
    id: "concept-os-deadlock-1",
    type: "concept_drop",
    category: "Learn",
    title: "🧠 Concept Drop: The 4 Deadlock Conditions",
    subject: "Operating Systems",
    topic: "Deadlocks & Concurrency",
    difficulty: "Easy",
    xp_reward: 15,
    source: "OS Core Fundamentals",
    action: "Understand Concept",
    created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
    content: "A deadlock occurs if and only if all four Coffman conditions hold simultaneously.",
    brief_markdown: `### The 4 Coffman Conditions:
1. **Mutual Exclusion**: At least one resource is held in a non-shareable mode.
2. **Hold and Wait**: A process is holding at least one resource and requesting additional resources.
3. **No Preemption**: Resources cannot be forcibly preempted from a process holding them.
4. **Circular Wait**: A closed chain of processes exists such that each process holds a resource needed by the next.`,
    interactive_type: "mcq",
    question: "Breaking which condition is the primary basis for Banker's Algorithm?",
    options: [
      "Mutual Exclusion",
      "Circular Wait (via safe state resource allocation)",
      "Process Priority",
      "Virtual Memory"
    ],
    correct_index: 1,
    explanation: "Banker's algorithm ensures that a request is only granted if the resulting state avoids circular wait patterns, maintaining a guaranteed safe execution sequence.",
    tags: ["OS", "Deadlock", "Concurrency", "Theory"]
  },

  // --- TECH RADAR & INDUSTRY INSIGHTS ---
  {
    id: "tech-radar-vector-embeddings-1",
    type: "tech_news",
    category: "Tech",
    title: "🌍 Tech Radar: How Vector Embeddings Power Modern AI",
    subject: "Artificial Intelligence",
    topic: "Vector Search & Retrieval Augmented Generation (RAG)",
    difficulty: "Medium",
    xp_reward: 15,
    source: "Verified Tech Insights",
    action: "Read Tech Radar",
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    content: "Modern RAG systems (like CoursePilot's reader) map text into 768-dimensional mathematical vector spaces where semantic proximity translates to geometric cosine similarity.",
    brief_markdown: `### Why High-Dimensional Vector Search Matters:
Traditional keyword search fails when users ask synonyms (e.g. "binary tree height" vs "depth of BST"). Vector embeddings capture latent semantic relationships:
$$\\text{similarity}(\\mathbf{u}, \\mathbf{v}) = \\frac{\\mathbf{u} \\cdot \\mathbf{v}}{\\|\\mathbf{u}\\| \\|\\mathbf{v}\\|}$$
This enables instant semantic grounding over campus notes and textbooks!`,
    interactive_type: "mcq",
    question: "What metric is most commonly used to measure distance between normalized embedding vectors?",
    options: [
      "Levenshtein Distance",
      "Cosine Similarity / Dot Product",
      "Hamming Distance",
      "Fourier Transform"
    ],
    correct_index: 1,
    explanation: "Cosine similarity measures the cosine of the angle between two vectors, effectively comparing semantic orientation regardless of document length.",
    tags: ["TechRadar", "AI", "Embeddings", "RAG"]
  },
  {
    id: "tech-radar-wasm-1",
    type: "tech_news",
    category: "Tech",
    title: "⚡ Tech Radar: WebAssembly in Modern Web Engineering",
    subject: "Software Engineering",
    topic: "Web Performance & Compilation",
    difficulty: "Easy",
    xp_reward: 15,
    source: "W3C Standards Review",
    action: "Explore Tech",
    created_at: new Date(Date.now() - 3600000 * 30).toISOString(),
    content: "WebAssembly (Wasm) allows C++, Rust, and Go code to execute in browser client sandboxes at near-native CPU speeds.",
    interactive_type: "mcq",
    question: "How does WebAssembly complement JavaScript in modern web applications?",
    options: [
      "It completely replaces JavaScript for DOM manipulation",
      "It provides near-native execution speed for compute-intensive tasks like PDF parsing, 3D graphics, and crypto",
      "It only runs inside Linux kernel modules",
      "It converts CSS styles to binary bytecode"
    ],
    correct_index: 1,
    explanation: "WebAssembly is designed to work alongside JavaScript, handling CPU-heavy computation while JavaScript manages DOM interactions and high-level routing.",
    tags: ["WebDev", "Wasm", "Performance", "SoftwareEngineering"]
  },

  // --- COMMUNITY & SECTION CHALLENGES ---
  {
    id: "community-b2-challenge-1",
    type: "peer_challenge",
    category: "Community",
    title: "🏆 Section B2 Cohort Challenge: Linked List Reversal",
    subject: "Data Structures & Algorithms",
    topic: "Linked Lists & Pointers",
    difficulty: "Medium",
    xp_reward: 35,
    source: "Section B2 Peer Study Group",
    action: "Join Challenge",
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    content: "Can Section B2 maintain a 90%+ pass rate on this pointer reversal challenge? 24 students have attempted so far.",
    code_snippet: `struct Node* reverse(struct Node* head) {
    struct Node *prev = NULL, *curr = head, *next = NULL;
    while (curr != NULL) {
        next = curr->next;
        curr->next = prev;
        prev = curr;
        curr = next;
    }
    return prev;
}`,
    interactive_type: "mcq",
    question: "What is the auxiliary space complexity of this iterative linked list reversal?",
    options: [
      "O(n) auxiliary space",
      "O(1) in-place auxiliary space",
      "O(log n) stack space",
      "O(n^2) space"
    ],
    correct_index: 1,
    explanation: "The iterative approach uses only three pointer variables (`prev`, `curr`, `next`), requiring constant O(1) auxiliary space without any recursion stack overhead.",
    tags: ["Community", "B2", "DSA", "Pointers"]
  },
  {
    id: "community-micro-project-1",
    type: "micro_project",
    category: "Community",
    title: "🚀 Micro-Project: Build an LRU Cache Simulator",
    subject: "Computer Science Architecture",
    topic: "Cache Eviction Policies & HashMaps",
    difficulty: "Hard",
    xp_reward: 50,
    source: "Campus Projects Hub",
    action: "Start Project",
    created_at: new Date(Date.now() - 3600000 * 36).toISOString(),
    content: "Combine a Doubly Linked List with a Hash Map to achieve O(1) get() and put() operations for an LRU cache.",
    interactive_type: "mcq",
    question: "Why is a Doubly Linked List used alongside a Hash Map in an LRU Cache?",
    options: [
      "To allow sorting elements by alphabetical key value",
      "To allow removing and inserting nodes at both head and tail in O(1) time",
      "To encrypt cached key-value entries in memory",
      "Because Python dictionaries do not support integers"
    ],
    correct_index: 1,
    explanation: "A doubly linked list allows removing any node in O(1) time once its pointer is found via the HashMap, and re-inserting it at the head (most recently used) in O(1) time.",
    tags: ["Projects", "Systems", "DSA", "Architecture"]
  }
]
