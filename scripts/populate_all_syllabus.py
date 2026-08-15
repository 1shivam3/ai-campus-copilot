import os
import re
from dotenv import load_dotenv
from supabase import create_client

load_dotenv("backend/.env")
url = os.getenv("VITE_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    raise RuntimeError("Missing Supabase credentials in backend/.env")

supabase = create_client(url, key)

# Define comprehensive syllabus definitions for each course code
SYLLABUS_CATALOG = {
    "BCSE-501": [
        {
            "unit_number": 1,
            "topic_name": "Linear Data Structures & Dynamic Memory Management",
            "description": "Static vs Dynamic Memory Management; Singly Linked List: representation and memory operations; Applications in polynomial representation and sparse matrix; Doubly & Circular Linked Lists; Stack & Queue linked representations."
        },
        {
            "unit_number": 2,
            "topic_name": "Trees & Tree Traversals",
            "description": "Binary Tree concepts, array and linked representations, Binary Tree Traversals (Inorder, Preorder, Postorder), Tree Variants, Threaded Binary Trees, Applications of Trees."
        },
        {
            "unit_number": 3,
            "topic_name": "Binary Search Trees & Balanced Trees",
            "description": "Binary Search Trees (BST): properties, search, insertion, and deletion; Balanced Search Trees: AVL Tree rotations and height balancing; Multi-way Search Trees, B-Trees and B+ Trees."
        },
        {
            "unit_number": 4,
            "topic_name": "Graphs & Hashing Techniques",
            "description": "Graph terminology, Adjacency Matrix and Adjacency List representations; Graph Traversals: BFS and DFS; Hashing: Hash Tables, Hash Functions, Collision Resolution strategies (Chaining, Open Addressing)."
        }
    ],
    "BCSE-501L": [
        {
            "unit_number": 1,
            "topic_name": "2D Arrays & Sparse Matrices",
            "description": "Implementation of 2D Arrays (9x9 grid operations: search, traversal, insertion, deletion) for Sudoku; Representation of Sparse Matrices using arrays and linked lists (Conway Game of Life)."
        },
        {
            "unit_number": 2,
            "topic_name": "Stack & Queue Applications",
            "description": "Stack ADT implementation with recursion and non-recursion (Tower of Hanoi); Circular Queue ADT implementation for CPU Job Scheduling."
        },
        {
            "unit_number": 3,
            "topic_name": "Binary Trees & Expression Parsing",
            "description": "Binary Tree memory representations; Mathematical Expression Tree evaluation and Infix-to-Postfix Expression Calculator."
        },
        {
            "unit_number": 4,
            "topic_name": "Graph Traversal & Dictionary Integrated Project",
            "description": "Graph memory representations, Travelling Salesman Problem routing; Integrated Dictionary Management Project using Hash Tables."
        }
    ],
    "BCSE-502": [
        {
            "unit_number": 1,
            "topic_name": "Introduction to Software Engineering & Process Models",
            "description": "Software characteristics, components, and applications; Software Development Life Cycle (SDLC); Waterfall model, Prototyping, Spiral model, Agile Software Development (Scrum, Kanban, XP)."
        },
        {
            "unit_number": 2,
            "topic_name": "Software Requirements Engineering & UML Modeling",
            "description": "Requirement gathering techniques, Software Requirement Specification (SRS) standards (IEEE 830), Use Case diagrams, Class diagrams, Sequence and Activity diagrams, Requirement Traceability Matrix (RTM)."
        },
        {
            "unit_number": 3,
            "topic_name": "Software Design Principles & Architectural Styles",
            "description": "Cohesion and Coupling, Modularity, Function-Oriented Design vs Object-Oriented Design, Architectural styles, User Interface Design guidelines."
        },
        {
            "unit_number": 4,
            "topic_name": "Software Testing, Quality Assurance & Maintenance",
            "description": "Verification vs Validation, Black-Box Testing (Equivalence Partitioning, BVA), White-Box Testing (Basis Path, Cyclomatic Complexity), Unit Testing, Integration Testing, System Testing, Software Metrics and Quality Standards (CMMI, ISO 9000)."
        }
    ],
    "BCSE-502L": [
        {
            "unit_number": 1,
            "topic_name": "SRS Specification & UML Diagram Design",
            "description": "Creating Software Requirement Specification (SRS) for Banking Applications; Use Case, Class, Object, Activity, and Sequence Diagrams; Requirement Traceability Matrix (RTM) and ETVX models."
        },
        {
            "unit_number": 2,
            "topic_name": "Test Case Design & Bug Tracking Tools",
            "description": "Designing Black-Box and White-Box test cases for ATM transactions; Installation and configuration of JIRA, MantisBT, and Bugzilla for defect tracking."
        },
        {
            "unit_number": 3,
            "topic_name": "Unit Testing & ATM Simulator Testing Project",
            "description": "Unit testing using JUnit framework; Defect management workflows; ATM Simulator functional testing project: test planning, test execution, defect logging, and reporting."
        },
        {
            "unit_number": 4,
            "topic_name": "Test Automation with TestComplete",
            "description": "Desktop application automation using TestComplete; Web Automation Test Project: End-to-end automated customer and admin booking flows on web travel portals."
        }
    ],
    "BCSE-503": [
        {
            "unit_number": 1,
            "topic_name": "Database System Architecture & ER Modeling",
            "description": "Data Abstraction, Data Independence, Three-Level Architecture, DBA roles, DDL and DML constructs; Entity-Relationship (ER) Model: entities, attributes, relationships, cardinality, Extended ER features."
        },
        {
            "unit_number": 2,
            "topic_name": "Relational Model & Relational Algebra",
            "description": "Relational Data Model concepts, Integrity Constraints, Relational Algebra operations (Select, Project, Join, Union, Difference), Tuple and Domain Relational Calculus, SQL DDL/DML constructs."
        },
        {
            "unit_number": 3,
            "topic_name": "Database Normalization & Query Optimization",
            "description": "Functional Dependencies, Armstrong's Axioms, Normal Forms (1NF, 2NF, 3NF, BCNF, 4NF, 5NF), Lossless Decomposition, Dependency Preservation; Query Processing & Optimization strategies."
        },
        {
            "unit_number": 4,
            "topic_name": "Transaction Management, Concurrency Control & Recovery",
            "description": "ACID Properties, Transaction States, Serializability, Concurrency Control: Lock-Based Protocols (2PL), Timestamp-Based Protocols; Deadlock detection and prevention; Log-Based Recovery techniques."
        }
    ],
    "BCSE-503L": [
        {
            "unit_number": 1,
            "topic_name": "ER Modeling & Schema Implementation",
            "description": "Drawing ER Diagrams for Library & University DBMS; Mapping ER models to relational schemas; Creating tables with Primary Key, Foreign Key, Unique, and Check constraints."
        },
        {
            "unit_number": 2,
            "topic_name": "SQL Queries, Aggregations & Joins",
            "description": "Data manipulation with INSERT, UPDATE, DELETE; SELECT queries with WHERE, ORDER BY, GROUP BY, HAVING; Inner, Outer, Left, Right, and Cross Joins; Nested and Correlated Subqueries."
        },
        {
            "unit_number": 3,
            "topic_name": "Built-in Functions, Views & Regular Expressions",
            "description": "MySQL String, Numeric, Date, and Conversion functions; Creating and managing Database Views; Regular Expressions in MySQL for complex pattern searching."
        },
        {
            "unit_number": 4,
            "topic_name": "Company & Airline Database Projects",
            "description": "Complete schema design, constraint verification, and advanced query execution on Company and Airline Flight Reservation database management systems."
        }
    ],
    "BCSE-504": [
        {
            "unit_number": 1,
            "topic_name": "Introduction to OOP & Java Language Basics",
            "description": "OOP Paradigm vs Procedural Programming; Features of Java, JDK, JVM, JRE architecture; Data types, Variables, Operators, Control structures; Classes, Objects, Methods, Method Overloading, Constructors."
        },
        {
            "unit_number": 2,
            "topic_name": "Inheritance, Polymorphism, Packages & Interfaces",
            "description": "Inheritance types, 'super' keyword, Method Overriding, Dynamic Method Dispatch, Abstract classes, 'final' keyword; Creating and importing Packages, Access Specifiers, Defining and implementing Interfaces."
        },
        {
            "unit_number": 3,
            "topic_name": "Exception Handling & Multithreading",
            "description": "Exception hierarchy, try, catch, finally, throw, throws, custom user-defined exceptions; Multithreading lifecycle, Thread class, Runnable interface, Thread priorities, Inter-thread communication, Synchronization."
        },
        {
            "unit_number": 4,
            "topic_name": "Java Collections Framework & GUI Programming",
            "description": "Collections Framework (List, ArrayList, LinkedList, Set, HashSet, Map, HashMap); AWT components, Layout Managers, Event Handling mechanisms, Delegated Event Model, GUI Applications."
        }
    ],
    "BCSE-504L": [
        {
            "unit_number": 1,
            "topic_name": "Java Basic Syntax & Control Flow Lab",
            "description": "Programs demonstrating data types, operators, conditional branches, loops, array manipulations, and basic algorithm implementations in Java."
        },
        {
            "unit_number": 2,
            "topic_name": "Classes, Inheritance & Polymorphism Lab",
            "description": "Creating classes and objects, constructor overloading, single/multilevel/hierarchical inheritance, method overriding, and interface implementations."
        },
        {
            "unit_number": 3,
            "topic_name": "Packages, Exceptions & Multithreaded Programs",
            "description": "Developing custom Java packages; Writing exception handling blocks and custom exceptions; Creating multithreaded applications with synchronization."
        },
        {
            "unit_number": 4,
            "topic_name": "Collections & Event-Driven GUI Projects",
            "description": "Implementation of dynamic data structures using Java Collections (ArrayList, HashMap); Developing interactive GUI calculators and desktop apps with AWT/Swing and Event Listeners."
        }
    ],
    "BCSE-505": [
        {
            "unit_number": 1,
            "topic_name": "Set Theory & Mathematical Logic",
            "description": "Sets, Relations, Equivalence Relations, Partial Orderings (Poset), Functions; Propositional Logic, Truth Tables, Tautologies, Logical Equivalence, Resolution Proof Systems, Predicate Logic, Quantifiers."
        },
        {
            "unit_number": 2,
            "topic_name": "Mathematical Induction & Combinatorics",
            "description": "Peano's Axioms, Principle of Mathematical Induction, Strong Induction, Pigeonhole Principle, Principle of Inclusion-Exclusion, Permutations & Combinations, Derangements, Bijection Principle."
        },
        {
            "unit_number": 3,
            "topic_name": "Linear Algebra & Recurrence Relations",
            "description": "Vector Spaces, Linear Combinations, Linear Independence, Basis and Dimension; Recurrence Relations: formulation, solving linear homogeneous and non-homogeneous recurrence relations, Generating Functions."
        },
        {
            "unit_number": 4,
            "topic_name": "Graph Theory & Algebraic Structures",
            "description": "Graph terminology, Paths, Cycles, Eulerian and Hamiltonian circuits, Trees, Spanning Trees, Minimum Spanning Trees (Kruskal, Prim); Groups, Monoids, Semigroups, Rings and Fields."
        }
    ],
    "BET-I": [
        {
            "unit_number": 1,
            "topic_name": "Quantitative Aptitude & Speed Calculation",
            "description": "Vedic Mathematics speed calculation techniques, Simplification, Number Systems, Remainder Theorem, Trailing Zeros, Factorials, Factors, HCF & LCM, Percentages, Profit, Loss & Discount, Ratio & Proportion."
        },
        {
            "unit_number": 2,
            "topic_name": "Logical Reasoning & Analytical Thinking",
            "description": "Coding-Decoding, Number Series, Alphanumeric Series, Direction Sense & Distances, Blood Relations, Syllogisms, Seating Arrangements, Statement & Assumptions, Critical Reasoning."
        },
        {
            "unit_number": 3,
            "topic_name": "Soft Skills, Verbal Ability & Communication",
            "description": "Introduction to corporate soft skills, Idea generation techniques, Prepositions, Tenses, Vocabulary, Sentence Correction, Reading Comprehension, Professional Email Writing."
        },
        {
            "unit_number": 4,
            "topic_name": "Interview Preparation & Professional Etiquette",
            "description": "Resume crafting, Self-introduction mastery, Group Discussion (GD) strategies, HR & Technical Interview etiquette, Workplace ethics and presentation skills."
        }
    ],
    "BHUM-118": [
        {
            "unit_number": 1,
            "topic_name": "Value Education & Process of Self-Exploration",
            "description": "Need, basic guidelines, content and process for Value Education; Self-Exploration: content and process; Natural Acceptance and Experiential Validation; Continuous Happiness and Prosperity as basic human aspirations."
        },
        {
            "unit_number": 2,
            "topic_name": "Harmony in the Human Being (Self and Body)",
            "description": "Human being as co-existence of the sentient 'I' (Self) and the material 'Body'; Needs of Self (Happiness) and Body (Physical Facilities); Harmony of 'I' with Body: Sanyam (Self-Control) and Swasthya (Health)."
        },
        {
            "unit_number": 3,
            "topic_name": "Harmony in the Family & Society",
            "description": "Values in Human Relationships: Trust (Vishwas) and Respect (Samman) as foundational values; Difference between respect and differentiation; Comprehensive Human Goal: Samadhan, Samridhi, Abhay, Sah-Astitva; Universal Human Order."
        },
        {
            "unit_number": 4,
            "topic_name": "Harmony in Nature & Universal Human Values",
            "description": "Understanding Harmony in Nature; Interconnectedness and mutual fulfillment among the four orders of nature (Material, Pranic, Animal, Human); Co-existence in Existence; Holistic Perception of harmony at all levels of living."
        }
    ],
    "BMAT-003C": [
        {
            "unit_number": 1,
            "topic_name": "Foundations of Statistics & Descriptive Measures",
            "description": "Frequency distribution and graphical representations (Histograms, Polygons, Ogives); Measures of Central Tendency (Arithmetic Mean, Geometric Mean, Harmonic Mean, Median, Mode); Measures of Dispersion (Range, Quartile Deviation, Mean Deviation, Standard Deviation, Variance, Coefficient of Variation)."
        },
        {
            "unit_number": 2,
            "topic_name": "Probability Theory & Discrete Distributions",
            "description": "Random Experiments, Sample Spaces, Events, Axiomatic definition of Probability, Conditional Probability, Bayes' Theorem; Random Variables (Discrete & Continuous), Probability Mass Function, Cumulative Distribution Function, Expected Value and Variance; Binomial and Poisson Distributions."
        },
        {
            "unit_number": 3,
            "topic_name": "Continuous Distributions, Correlation & Regression",
            "description": "Normal Distribution: properties, standard normal curve, applications; Bivariate data analysis: Scatter diagram, Karl Pearson's Coefficient of Correlation, Spearman's Rank Correlation; Linear Regression equations and lines of regression; Curve fitting by method of least squares."
        },
        {
            "unit_number": 4,
            "topic_name": "Sampling Theory & Hypothesis Testing",
            "description": "Population and Samples, Parameter and Statistic, Sampling Distributions, Central Limit Theorem; Hypothesis Testing: Null & Alternative Hypotheses, Type I & Type II Errors, Level of Significance; Large sample tests (Z-test), Small sample tests (Student's t-test for single mean and difference of means, F-test, Chi-Square test for Goodness of Fit and Independence of Attributes)."
        }
    ]
}

def populate():
    print("Fetching academic_subjects for semester 3...")
    res = supabase.from_("academic_subjects").select("id, semester, section, subject_code, subject_name").eq("semester", 3).execute()
    
    if not res.data:
        print("No academic_subjects found for semester 3!")
        return

    print(f"Found {len(res.data)} subject records across sections.")
    
    # Clean existing syllabus_topics to ensure a fresh, consistent import
    print("Cleaning existing syllabus_topics...")
    # Get all subject IDs for semester 3
    subject_ids = [row["id"] for row in res.data]
    
    # Delete existing syllabus_topics in batches
    for i in range(0, len(subject_ids), 100):
        batch_ids = subject_ids[i:i+100]
        supabase.from_("syllabus_topics").delete().in_("subject_id", batch_ids).execute()
        
    print("Existing syllabus_topics cleaned.")

    records_to_insert = []
    
    for subject in res.data:
        code = (subject.get("subject_code") or "").strip().upper()
        # Find matching key in catalog
        matched_topics = SYLLABUS_CATALOG.get(code)
        
        # If not matched directly, check substring matching
        if not matched_topics:
            for catalog_code in SYLLABUS_CATALOG:
                if catalog_code in code or code in catalog_code:
                    matched_topics = SYLLABUS_CATALOG[catalog_code]
                    break
                    
        if matched_topics:
            for topic in matched_topics:
                records_to_insert.append({
                    "subject_id": subject["id"],
                    "unit_number": topic["unit_number"],
                    "topic_name": topic["topic_name"],
                    "description": topic["description"],
                })

    print(f"Total syllabus topic records prepared for insertion: {len(records_to_insert)}")
    
    # Insert in batches of 200
    batch_size = 200
    for i in range(0, len(records_to_insert), batch_size):
        batch = records_to_insert[i:i+batch_size]
        supabase.from_("syllabus_topics").insert(batch).execute()
        print(f"Inserted batch {i // batch_size + 1} / {(len(records_to_insert) + batch_size - 1) // batch_size} ({len(batch)} rows)")

    print("\nSUCCESS: All university syllabus topics successfully populated into Supabase database!")

if __name__ == "__main__":
    populate()
