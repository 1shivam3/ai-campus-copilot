import os
import sys
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))
url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not url or not key:
    raise RuntimeError("Missing Supabase credentials")

supabase = create_client(url, key)

# Authoritative syllabus catalog extracted directly from official syllabus PDFs
SYLLABUS_CATALOG = {
    # ---------------------------------------------------------
    # THEORY SUBJECTS (4 Units each)
    # ---------------------------------------------------------
    "BCSE-501": {
        "type": "Theory",
        "name": "Data Structure and Algorithms",
        "items": [
            {
                "number": 1,
                "title": "Linear Data Structures & Dynamic Memory Management",
                "description": "Static vs Dynamic Memory Management; Singly Linked List: representation and memory operations; Applications in polynomial representation and sparse matrix; Doubly & Circular Linked Lists; Stack & Queue linked representations."
            },
            {
                "number": 2,
                "title": "Trees & Tree Traversals",
                "description": "Binary Tree concepts, array and linked representations, Binary Tree Traversals (Inorder, Preorder, Postorder), Tree Variants, Threaded Binary Trees, Applications of Trees."
            },
            {
                "number": 3,
                "title": "Binary Search Trees & Balanced Trees",
                "description": "Binary Search Trees (BST): properties, search, insertion, and deletion; Balanced Search Trees: AVL Tree rotations and height balancing; Multi-way Search Trees, B-Trees and B+ Trees."
            },
            {
                "number": 4,
                "title": "Graphs & Hashing Techniques",
                "description": "Graph terminology, Adjacency Matrix and Adjacency List representations; Graph Traversals: BFS and DFS; Hashing: Hash Tables, Hash Functions, Collision Resolution strategies (Chaining, Open Addressing)."
            }
        ]
    },
    "BCSE-502": {
        "type": "Theory",
        "name": "Software Engineering",
        "items": [
            {
                "number": 1,
                "title": "Introduction to Software Engineering & Process Models",
                "description": "Software characteristics, components, and applications; Software Development Life Cycle (SDLC); Waterfall model, Prototyping, Spiral model, Agile Software Development (Scrum, Kanban, XP)."
            },
            {
                "number": 2,
                "title": "Software Requirements Engineering & UML Modeling",
                "description": "Requirement gathering techniques, Software Requirement Specification (SRS) standards (IEEE 830), Use Case diagrams, Class diagrams, Sequence and Activity diagrams, Requirement Traceability Matrix (RTM)."
            },
            {
                "number": 3,
                "title": "Software Design Principles & Architectural Styles",
                "description": "Cohesion and Coupling, Modularity, Function-Oriented Design vs Object-Oriented Design, Architectural styles, User Interface Design guidelines."
            },
            {
                "number": 4,
                "title": "Software Testing, Quality Assurance & Maintenance",
                "description": "Verification vs Validation, Black-Box Testing (Equivalence Partitioning, BVA), White-Box Testing (Basis Path, Cyclomatic Complexity), Unit Testing, Integration Testing, System Testing, Software Metrics and Quality Standards (CMMI, ISO 9000)."
            }
        ]
    },
    "BCSE-503": {
        "type": "Theory",
        "name": "Database Management System",
        "items": [
            {
                "number": 1,
                "title": "Database System Architecture & ER Modeling",
                "description": "Data Abstraction, Data Independence, Three-Level Architecture, DBA roles, DDL and DML constructs; Entity-Relationship (ER) Model: entities, attributes, relationships, cardinality, Extended ER features."
            },
            {
                "number": 2,
                "title": "Relational Model & Relational Algebra",
                "description": "Relational Data Model concepts, Integrity Constraints, Relational Algebra operations (Select, Project, Join, Union, Difference), Tuple and Domain Relational Calculus, SQL DDL/DML constructs."
            },
            {
                "number": 3,
                "title": "Database Normalization & Query Optimization",
                "description": "Functional Dependencies, Armstrong's Axioms, Normal Forms (1NF, 2NF, 3NF, BCNF, 4NF, 5NF), Lossless Decomposition, Dependency Preservation; Query Processing & Optimization strategies."
            },
            {
                "number": 4,
                "title": "Transaction Management, Concurrency Control & Recovery",
                "description": "ACID Properties, Transaction States, Serializability, Concurrency Control: Lock-Based Protocols (2PL), Timestamp-Based Protocols; Deadlock detection and prevention; Log-Based Recovery techniques."
            }
        ]
    },
    "BCSE-504": {
        "type": "Theory",
        "name": "Object Oriented Programming Using JAVA",
        "items": [
            {
                "number": 1,
                "title": "Introduction to OOP & Java Language Basics",
                "description": "OOP Paradigm vs Procedural Programming; Features of Java, JDK, JVM, JRE architecture; Data types, Variables, Operators, Control structures; Classes, Objects, Methods, Method Overloading, Constructors."
            },
            {
                "number": 2,
                "title": "Inheritance, Polymorphism, Packages & Interfaces",
                "description": "Inheritance types, 'super' keyword, Method Overriding, Dynamic Method Dispatch, Abstract classes, 'final' keyword; Creating and importing Packages, Access Specifiers, Defining and implementing Interfaces."
            },
            {
                "number": 3,
                "title": "Exception Handling & Multithreading",
                "description": "Exception hierarchy, try, catch, finally, throw, throws, custom user-defined exceptions; Multithreading lifecycle, Thread class, Runnable interface, Thread priorities, Inter-thread communication, Synchronization."
            },
            {
                "number": 4,
                "title": "Java Collections Framework & GUI Programming",
                "description": "Collections Framework (List, ArrayList, LinkedList, Set, HashSet, Map, HashMap); AWT components, Layout Managers, Event Handling mechanisms, Delegated Event Model, GUI Applications."
            }
        ]
    },
    "BCSE-505": {
        "type": "Theory",
        "name": "Discrete Structures",
        "items": [
            {
                "number": 1,
                "title": "Set Theory & Mathematical Logic",
                "description": "Sets, Relations, Equivalence Relations, Partial Orderings (Poset), Functions; Propositional Logic, Truth Tables, Tautologies, Logical Equivalence, Resolution Proof Systems, Predicate Logic, Quantifiers."
            },
            {
                "number": 2,
                "title": "Mathematical Induction & Combinatorics",
                "description": "Peano's Axioms, Principle of Mathematical Induction, Strong Induction, Pigeonhole Principle, Principle of Inclusion-Exclusion, Permutations & Combinations, Derangements, Bijection Principle."
            },
            {
                "number": 3,
                "title": "Linear Algebra & Recurrence Relations",
                "description": "Vector Spaces, Linear Combinations, Linear Independence, Basis and Dimension; Recurrence Relations: formulation, solving linear homogeneous and non-homogeneous recurrence relations, Generating Functions."
            },
            {
                "number": 4,
                "title": "Graph Theory & Algebraic Structures",
                "description": "Graph terminology, Paths, Cycles, Eulerian and Hamiltonian circuits, Trees, Spanning Trees, Minimum Spanning Trees (Kruskal, Prim); Groups, Monoids, Semigroups, Rings and Fields."
            }
        ]
    },
    "BHUM-118": {
        "type": "Theory",
        "name": "Human Value & Ethics",
        "items": [
            {
                "number": 1,
                "title": "Value Education & Process of Self-Exploration",
                "description": "Need, basic guidelines, content and process for Value Education; Self-Exploration: content and process; Natural Acceptance and Experiential Validation; Continuous Happiness and Prosperity as basic human aspirations."
            },
            {
                "number": 2,
                "title": "Harmony in the Human Being (Self and Body)",
                "description": "Human being as co-existence of the sentient 'I' (Self) and the material 'Body'; Needs of Self (Happiness) and Body (Physical Facilities); Harmony of 'I' with Body: Sanyam (Self-Control) and Swasthya (Health)."
            },
            {
                "number": 3,
                "title": "Harmony in the Family & Society",
                "description": "Values in Human Relationships: Trust (Vishwas) and Respect (Samman) as foundational values; Difference between respect and differentiation; Comprehensive Human Goal: Samadhan, Samridhi, Abhay, Sah-Astitva; Universal Human Order."
            },
            {
                "number": 4,
                "title": "Harmony in Nature & Universal Human Values",
                "description": "Understanding Harmony in Nature; Interconnectedness and mutual fulfillment among the four orders of nature (Material, Pranic, Animal, Human); Co-existence in Existence; Holistic Perception of harmony at all levels of living."
            }
        ]
    },
    "BMAT-003C": {
        "type": "Theory",
        "name": "Statistical Techniques",
        "items": [
            {
                "number": 1,
                "title": "Foundations of Statistics & Descriptive Measures",
                "description": "Frequency distribution and graphical representations (Histograms, Polygons, Ogives); Measures of Central Tendency (Arithmetic Mean, Geometric Mean, Harmonic Mean, Median, Mode); Measures of Dispersion (Range, Quartile Deviation, Mean Deviation, Standard Deviation, Variance, Coefficient of Variation)."
            },
            {
                "number": 2,
                "title": "Probability Theory & Discrete Distributions",
                "description": "Random Experiments, Sample Spaces, Events, Axiomatic definition of Probability, Conditional Probability, Bayes' Theorem; Random Variables (Discrete & Continuous), Probability Mass Function, Cumulative Distribution Function, Expected Value and Variance; Binomial and Poisson Distributions."
            },
            {
                "number": 3,
                "title": "Continuous Distributions, Correlation & Regression",
                "description": "Normal Distribution: properties, standard normal curve, applications; Bivariate data analysis: Scatter diagram, Karl Pearson's Coefficient of Correlation, Spearman's Rank Correlation; Linear Regression equations and lines of regression; Curve fitting by method of least squares."
            },
            {
                "number": 4,
                "title": "Sampling Theory & Hypothesis Testing",
                "description": "Population and Samples, Parameter and Statistic, Sampling Distributions, Central Limit Theorem; Hypothesis Testing: Null & Alternative Hypotheses, Type I & Type II Errors, Level of Significance; Large sample tests (Z-test), Small sample tests (Student's t-test for single mean and difference of means, F-test, Chi-Square test for Goodness of Fit and Independence of Attributes)."
            }
        ]
    },

    # ---------------------------------------------------------
    # LAB SUBJECTS (Actual Practicals)
    # ---------------------------------------------------------
    "BCSE-501L": {
        "type": "Lab",
        "name": "Data Structure and Algorithms Lab",
        "items": [
            {
                "number": 1,
                "title": "2D Array Operations (9x9 Grid) & Su-Do-Ku Puzzle Solver",
                "description": "Declare a 2D Array with dimensions of 9 x 9. Implement Search, Traversal, Sum of all elements, Insertion, and Deletion. Use learned array concepts to validate and solve the 9x9 Su-Do-Ku Puzzle."
            },
            {
                "number": 2,
                "title": "Sparse Matrix Representation & Conway Game of Life",
                "description": "Implement memory-efficient representation of sparse matrices using 2D arrays and linked lists. Benchmark non-zero matrix storage and test using the Conway's Game of Life grid simulation."
            },
            {
                "number": 3,
                "title": "Stack ADT Operations & Tower of Hanoi",
                "description": "Implement Stack ADT with array and linked representations. Solve the classic Tower of Hanoi recursive and non-recursive mathematical problem adhering to disk placement constraints."
            },
            {
                "number": 4,
                "title": "Queue ADT Operations & CPU Job Scheduling",
                "description": "Implement Linear and Circular Queue ADTs. Develop a CPU Job Scheduling simulation allocating CPU execution slices to prioritized incoming job queues."
            },
            {
                "number": 5,
                "title": "Binary Tree Memory Representation (Array & Linked List)",
                "description": "Implement dynamic memory representations of binary trees using sequential array storage and doubly-linked node pointers with recursive traversals."
            },
            {
                "number": 6,
                "title": "Mathematical Expression Tree & Expression Calculator",
                "description": "Build an Expression Tree to parse arithmetic expressions, convert infix notations to postfix/prefix forms, and evaluate composite mathematical expressions."
            },
            {
                "number": 7,
                "title": "Graph Memory Representation & Travelling Salesman Problem",
                "description": "Implement Graph representations using Adjacency Matrix and Adjacency Lists. Formulate and solve the Travelling Salesman Problem (TSP) routing challenge."
            },
            {
                "number": 8,
                "title": "Integrated Project: Dictionary Management using Hashing",
                "description": "Mandatory Integrated Project: Load dictionary datasets into structured collections (Array, Linked List, Stack, Queue) to perform Search, Sorted Insertion, Deletion, and accelerated lookups via Hash Tables."
            }
        ]
    },
    "BCSE-502L": {
        "type": "Lab",
        "name": "Software Engineering Lab",
        "items": [
            {
                "number": 1,
                "title": "Software Requirement Specification (SRS) Design",
                "description": "Create IEEE 830-compliant Software Requirement Specification (SRS) for Banking Application Management including functional and non-functional requirements."
            },
            {
                "number": 2,
                "title": "UML Use Case, Class & Object Diagrams",
                "description": "Design Use Case diagrams with actors and system boundaries; Create Class and Object diagrams modeling entities for Banking Management System."
            },
            {
                "number": 3,
                "title": "UML Activity & Sequence Diagrams",
                "description": "Model business workflows and asynchronous interaction flows using UML Activity Diagrams and Sequence Diagrams for Bank transactions."
            },
            {
                "number": 4,
                "title": "Requirement Traceability Matrix (RTM)",
                "description": "Create forward and backward Requirement Traceability Matrices (RTM) linking user requirements to system architecture and verification test cases."
            },
            {
                "number": 5,
                "title": "ETVX Process Modeling",
                "description": "Create ETVX (Entry Criteria, Tasks, Verification, eXit Criteria) software process models for project milestone validation."
            },
            {
                "number": 6,
                "title": "White-Box Test Case Design for ATM Transactions",
                "description": "Construct control flow graphs, calculate Cyclomatic Complexity, and design White-Box test cases covering all independent execution paths for ATM transactions."
            },
            {
                "number": 7,
                "title": "Black-Box Test Case Design for ATM Transactions",
                "description": "Design comprehensive Black-Box test suites for ATM withdrawals and transfers using Equivalence Partitioning and Boundary Value Analysis (BVA)."
            },
            {
                "number": 8,
                "title": "Defect Tracking Tools Installation & Comparative Analysis",
                "description": "Install, configure, and evaluate JIRA, MantisBT, and Bugzilla. Author a detailed tool comparison analysis report regarding enterprise defect management suitability."
            },
            {
                "number": 9,
                "title": "Unit Testing with JUnit Framework",
                "description": "Implement unit testing using JUnit test annotations (@Test, @Before, @After, Assertions). Execute test suites via JUnit Test Runner and analyze test logs."
            },
            {
                "number": 10,
                "title": "Defect Management Workflow using MantisBT / Bugzilla",
                "description": "Setup project workspace, configure user roles (Admin, Tester, Developer), define custom tracking fields, and execute defect triage with severity and priority."
            },
            {
                "number": 11,
                "title": "Testing Project: ATM Simulator Functional & System Testing",
                "description": "Execute complete testing lifecycle on Java ATM Simulator: Phase 1 Test Case Design (JUnit), Phase 2 Defect Logging in MantisBT, Phase 3 Test Planning with RACI matrix, Phase 4 Presentation."
            },
            {
                "number": 12,
                "title": "Desktop Application Automation with TestComplete",
                "description": "Install TestComplete automation suite. Record and parameterize automated functional and GUI tests for desktop software workflows."
            },
            {
                "number": 13,
                "title": "Test Automation Project: Web Travel Portal End-to-End Testing",
                "description": "Develop automated web test suites on PHPTravels portal: Customer booking flows, Admin portal offer management, Supplier workflows, and Cross-Browser compatibility suites."
            }
        ]
    },
    "BCSE-503L": {
        "type": "Lab",
        "name": "Database Management System Lab",
        "items": [
            {
                "number": 1,
                "title": "ER Modeling for Library DBMS",
                "description": "Construct Entity-Relationship (ER) model for Library Management System identifying entity sets, multi-valued attributes, keys, and cardinality ratios."
            },
            {
                "number": 2,
                "title": "Relational Schema Mapping from ER Diagrams",
                "description": "Translate ER diagrams into 3NF normalized relational table schemas resolving 1:1, 1:N, and M:N relationships."
            },
            {
                "number": 3,
                "title": "Table Creation with Integrity Constraints (DDL)",
                "description": "Execute SQL DDL statements (CREATE TABLE) enforcing Primary Key, Foreign Key, NOT NULL, UNIQUE, and CHECK constraints."
            },
            {
                "number": 4,
                "title": "Schema Structure Inspection & Alteration",
                "description": "Utilize DESCRIBE and ALTER TABLE commands to modify schema layouts, add/drop columns, and modify column constraints in MySQL."
            },
            {
                "number": 5,
                "title": "Data Manipulation Operations (DML)",
                "description": "Populate and manipulate database records using INSERT INTO, UPDATE, and DELETE statements while validating referential integrity rules."
            },
            {
                "number": 6,
                "title": "SQL Query Execution with Operators & Predicates",
                "description": "Query records using SELECT with comparison operators, logical conjunctions, BETWEEN range predicates, IN set memberships, and LIKE pattern matching."
            },
            {
                "number": 7,
                "title": "Aggregations, GROUP BY, HAVING & Subqueries",
                "description": "Execute grouped aggregations using COUNT, SUM, AVG, MIN, MAX with GROUP BY and HAVING clauses; formulate nested and correlated subqueries."
            },
            {
                "number": 8,
                "title": "MySQL String, Numeric & Date Functions",
                "description": "Execute built-in SQL scalar functions: String (CONCAT, SUBSTR, UPPER), Numeric (ROUND, CEIL, MOD), and Temporal functions (CURDATE, DATEDIFF)."
            },
            {
                "number": 9,
                "title": "Data Conversion & Conditional Expressions",
                "description": "Implement data type conversions using CAST and CONVERT; execute conditional queries using IFNULL, COALESCE, and CASE-WHEN-THEN expressions."
            },
            {
                "number": 10,
                "title": "Privileges & Cascading Referential Constraints",
                "description": "Manage database security with GRANT and REVOKE commands; verify Foreign Key ON DELETE CASCADE and ON UPDATE CASCADE actions."
            },
            {
                "number": 11,
                "title": "Relational Joins Implementation in MySQL",
                "description": "Execute multi-table relational joins: Inner Join, Left Outer Join, Right Outer Join, and Cross Product Joins with complex join predicates."
            },
            {
                "number": 12,
                "title": "Regular Expression Pattern Searching in MySQL",
                "description": "Perform complex string matching and data validation using MySQL REGEXP / RLIKE operators and regular expression patterns."
            },
            {
                "number": 13,
                "title": "Database Project: Company & Employee Management DBMS",
                "description": "Design normalized schema, establish views, enforce multi-table constraints, and execute reporting queries on enterprise Company & Department DBMS."
            },
            {
                "number": 14,
                "title": "Database Project: Airline Flight Reservation DBMS",
                "description": "End-to-end database architecture for Airline Flight Reservation: Flight scheduling, Passenger booking, Seat allocation, and Real-time query execution."
            }
        ]
    },
    "BCSE-504L": {
        "type": "Lab",
        "name": "Object Oriented Programming Using JAVA Lab",
        "items": [
            {
                "number": 1,
                "title": "Gross & Dozen Egg Calculation with Console I/O",
                "description": "Develop Java console application using Scanner to compute gross (144 units), dozen (12 units), and leftover inventory counts with formatted I/O."
            },
            {
                "number": 2,
                "title": "Variable Value Swapping without Temporary Variable",
                "description": "Read two numerical inputs from console, execute value swapping utilizing arithmetic and bitwise XOR operations without auxiliary storage, and print results."
            },
            {
                "number": 3,
                "title": "Income Tax Calculation with Conditional Slabs",
                "description": "Implement well-indented nested if-else structures to compute progressive income tax assessments across multiple income brackets for general and female citizens."
            },
            {
                "number": 4,
                "title": "Calculator Class with Method Overloading",
                "description": "Construct a Calculator class implementing static/instance method overloading with varying parameter signatures demonstrating compile-time polymorphism."
            },
            {
                "number": 5,
                "title": "User-Defined Packages (`org.animals` & `zoo.VandalurZoo`)",
                "description": "Create modular user-defined package `org.animals` with encapsulated animal classes; consume package across independent project `zoo.VandalurZoo`."
            },
            {
                "number": 6,
                "title": "Method Overriding & Dynamic Polymorphism",
                "description": "Demonstrate runtime polymorphism by overriding superclass member methods in inherited subclasses with dynamic method dispatch."
            },
            {
                "number": 7,
                "title": "Interfaces & Abstract Classes Contract Implementation",
                "description": "Design abstract classes with pure virtual methods and multiple interface implementations modeling multiple inheritance."
            },
            {
                "number": 8,
                "title": "Exception Handling (`try`, `catch`, `finally`, custom exceptions)",
                "description": "Develop structured exception handling blocks managing runtime exceptions, custom banking exceptions, and resource cleanup with finally."
            },
            {
                "number": 9,
                "title": "Multithreading & Thread Synchronization",
                "description": "Create multithreaded applications extending Thread class, utilizing sleep(), priority control, context switching, and synchronized blocks."
            },
            {
                "number": 10,
                "title": "Event-Driven Graphical User Interface (AWT & Swing)",
                "description": "Build desktop GUI applications with JFrame, JPanel, JButton, JTextField, and event handling via ActionListener and ItemListener interfaces."
            },
            {
                "number": 11,
                "title": "Java Project: Learning Management System (LMS)",
                "description": "Comprehensive object-oriented desktop application managing course enrollments, student records, assignments, and file-based data persistence."
            },
            {
                "number": 12,
                "title": "Java Project: Online Shopping Cart System",
                "description": "Develop an interactive e-commerce shopping cart system with item catalog, cart manipulation, discount calculation, and invoice generation."
            }
        ]
    }
}


def populate_syllabus():
    print("=======================================================")
    print("      RE-POPULATING SYLLABUS DATA MODEL & MAPPINGS      ")
    print("=======================================================")

    # 1. Fetch all academic_subjects for semester 3
    print("1. Fetching academic_subjects for semester 3...")
    res = supabase.table("academic_subjects").select("id, semester, section, subject_code, subject_name, subject_type").eq("semester", 3).execute()
    subjects = res.data or []
    print(f"   Found {len(subjects)} subject rows across all sections.")

    # 2. Update subject_type in academic_subjects if needed (e.g. BCSE-501L -> Lab, BCSE-501 -> Theory)
    print("\n2. Synchronizing subject_type in academic_subjects table...")
    for code, info in SYLLABUS_CATALOG.items():
        stype = info["type"]
        supabase.table("academic_subjects").update({"subject_type": stype}).eq("semester", 3).eq("subject_code", code).execute()

    # 3. Clean existing syllabus_topics for semester 3 subjects
    print("\n3. Cleaning old syllabus_topics records...")
    subject_ids = [s["id"] for s in subjects]
    for i in range(0, len(subject_ids), 100):
        batch = subject_ids[i:i+100]
        supabase.table("syllabus_topics").delete().in_("subject_id", batch).execute()
    print("   Old syllabus_topics cleaned.")

    # 4. Insert accurate topics/practicals for only the 11 catalog subjects
    print("\n4. Inserting syllabus topics & practicals mapped strictly by subject_code...")
    records_to_insert = []

    for s in subjects:
        code = (s.get("subject_code") or "").strip().upper()
        if code in SYLLABUS_CATALOG:
            catalog_entry = SYLLABUS_CATALOG[code]
            for item in catalog_entry["items"]:
                records_to_insert.append({
                    "subject_id": s["id"],
                    "unit_number": item["number"],
                    "topic_name": item["title"],
                    "description": item["description"],
                })

    print(f"   Total records prepared for insertion: {len(records_to_insert)}")

    # Batch insert
    batch_size = 200
    for i in range(0, len(records_to_insert), batch_size):
        batch = records_to_insert[i:i+batch_size]
        supabase.table("syllabus_topics").insert(batch).execute()
        print(f"   Inserted batch {i // batch_size + 1} / {(len(records_to_insert) + batch_size - 1) // batch_size}")

    print("\n=======================================================")
    print(" SYLLABUS POPULATION COMPLETE (100% SUCCESS) ")
    print("=======================================================")


if __name__ == "__main__":
    populate_syllabus()
