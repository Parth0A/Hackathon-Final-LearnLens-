from typing import Any


CONCEPTS: list[dict[str, str]] = [
    {"id": "arrays", "name": "Arrays", "description": "Ordered elements stored in contiguous positions.", "difficulty": "foundation"},
    {"id": "linked_list", "name": "Linked List", "description": "A chain of nodes connected by references.", "difficulty": "foundation"},
    {"id": "node", "name": "Node", "description": "A unit that stores data and a link to another node.", "difficulty": "foundation"},
    {"id": "traversal", "name": "Traversal", "description": "Visiting each element in a structure in sequence.", "difficulty": "intermediate"},
    {"id": "insertion", "name": "Insertion", "description": "Adding a new element while maintaining structure links.", "difficulty": "intermediate"},
    {"id": "lifo", "name": "LIFO", "description": "Last-In, First-Out: the newest item leaves first.", "difficulty": "foundation"},
    {"id": "stack", "name": "Stack", "description": "A data structure that follows the LIFO principle.", "difficulty": "intermediate"},
    {"id": "push", "name": "Push", "description": "The stack operation that adds an item to the top.", "difficulty": "intermediate"},
    {"id": "pop", "name": "Pop", "description": "The stack operation that removes the top item.", "difficulty": "intermediate"},
    {"id": "fifo", "name": "FIFO", "description": "First-In, First-Out: the oldest item leaves first.", "difficulty": "foundation"},
    {"id": "queue", "name": "Queue", "description": "A data structure that follows the FIFO principle.", "difficulty": "intermediate"},
    {"id": "enqueue", "name": "Enqueue", "description": "The queue operation that adds an item at the rear.", "difficulty": "intermediate"},
    {"id": "dequeue", "name": "Dequeue", "description": "The queue operation that removes an item from the front.", "difficulty": "intermediate"},
]

PREREQUISITES = [
    ("lifo", "stack"), ("stack", "push"), ("stack", "pop"),
    ("fifo", "queue"), ("queue", "enqueue"), ("queue", "dequeue"),
    ("linked_list", "node"), ("linked_list", "traversal"), ("linked_list", "insertion"),
]


def question(qid: str, text: str, options: list[str], answer: str, concept: str, prerequisite: str | None, difficulty: str, misconception: str) -> dict[str, Any]:
    return {
        "id": qid, "text": text, "options": options, "correct_answer": answer,
        "concept_id": concept, "prerequisite_concept_id": prerequisite,
        "difficulty": difficulty, "misconception_tag": misconception,
        "source": {"source": "Data Structures Course Material", "chapter": "Core Structures", "section": concept.replace("_", " ").title()},
    }


QUESTIONS = [
    question("q01", "What is the usual time complexity of reading an array element by index?", ["O(1)", "O(n)", "O(log n)", "O(n²)"], "O(1)", "arrays", None, "foundation", "ARRAY_ACCESS_CONFUSION"),
    question("q02", "Why are array elements quick to access by index?", ["They are contiguous in memory", "They are always sorted", "They use a queue", "They have no indexes"], "They are contiguous in memory", "arrays", None, "foundation", "ARRAY_MEMORY_CONFUSION"),
    question("q03", "In a zero-indexed array, which position stores the first element?", ["0", "1", "-1", "The last position"], "0", "arrays", None, "foundation", "INDEXING_CONFUSION"),
    question("q04", "What does a linked-list node typically contain?", ["Data and a link", "Only an index", "A sorted array", "A queue counter"], "Data and a link", "node", "linked_list", "foundation", "NODE_STRUCTURE_CONFUSION"),
    question("q05", "What does linked-list traversal mean?", ["Visiting nodes in sequence", "Sorting every node", "Removing the head", "Adding to the rear"], "Visiting nodes in sequence", "traversal", "linked_list", "intermediate", "TRAVERSAL_CONFUSION"),
    question("q06", "Where does a linked list usually begin?", ["At the head", "At the rear only", "At the middle node", "At index zero in an array"], "At the head", "linked_list", "node", "foundation", "LINKED_LIST_HEAD_CONFUSION"),
    question("q07", "What must be updated when inserting a node after another node?", ["The relevant links", "Every array index", "The FIFO rule", "Only the node's color"], "The relevant links", "insertion", "linked_list", "intermediate", "POINTER_UPDATE_CONFUSION"),
    question("q08", "Which principle does a Stack follow?", ["FIFO", "LIFO", "Random order", "Sorted order"], "LIFO", "stack", "lifo", "intermediate", "FIFO_LIFO_CONFUSION"),
    question("q09", "Which principle means the last item added leaves first?", ["FIFO", "LIFO", "FILO only for queues", "Index order"], "LIFO", "lifo", None, "foundation", "FIFO_LIFO_CONFUSION"),
    question("q10", "A stack receives A, then B, then C. Which item is removed first?", ["A", "B", "C", "All at once"], "C", "stack", "lifo", "intermediate", "FIFO_LIFO_CONFUSION"),
    question("q11", "Which everyday example best matches LIFO?", ["A checkout line", "A stack of plates", "A calendar", "A phone book"], "A stack of plates", "lifo", None, "foundation", "FIFO_LIFO_CONFUSION"),
    question("q12", "Which structure is commonly used for undo actions?", ["Stack", "Queue", "Array only", "Linked list tail only"], "Stack", "stack", "lifo", "intermediate", "STACK_QUEUE_OPERATION_CONFUSION"),
    question("q13", "What does the Push operation do?", ["Adds an item to the top of a stack", "Removes the oldest queue item", "Adds to the front of a queue", "Visits every node"], "Adds an item to the top of a stack", "push", "stack", "intermediate", "PUSH_POP_CONFUSION"),
    question("q14", "What does Pop remove from a stack?", ["The top item", "The bottom item", "The first queue item", "Every item"], "The top item", "pop", "stack", "intermediate", "PUSH_POP_CONFUSION"),
    question("q15", "Which principle does a Queue follow?", ["LIFO", "FIFO", "Last sorted", "Random order"], "FIFO", "queue", "fifo", "intermediate", "FIFO_LIFO_CONFUSION"),
    question("q16", "Which principle means the first item added leaves first?", ["FIFO", "LIFO", "Top-first", "Reverse index"], "FIFO", "fifo", None, "foundation", "FIFO_LIFO_CONFUSION"),
    question("q17", "A queue receives A, then B, then C. Which item is removed first?", ["A", "B", "C", "The newest item"], "A", "queue", "fifo", "intermediate", "FIFO_LIFO_CONFUSION"),
    question("q18", "Which operation adds an element to a Queue?", ["Pop", "Push", "Enqueue", "Dequeue"], "Enqueue", "enqueue", "queue", "intermediate", "STACK_QUEUE_OPERATION_CONFUSION"),
    question("q19", "Which operation removes an element from the front of a Queue?", ["Enqueue", "Dequeue", "Push", "Pop"], "Dequeue", "dequeue", "queue", "intermediate", "STACK_QUEUE_OPERATION_CONFUSION"),
    question("q20", "A queue is useful when work should be handled in what order?", ["First come, first served", "Newest first", "Largest first", "Randomly"], "First come, first served", "queue", "fifo", "foundation", "FIFO_LIFO_CONFUSION"),
    question("q21", "Which operation adds an item to the rear of a queue?", ["Enqueue", "Dequeue", "Pop", "Peek"], "Enqueue", "enqueue", "queue", "intermediate", "STACK_QUEUE_OPERATION_CONFUSION"),
    question("q22", "Which operation removes the next available item from a queue?", ["Dequeue", "Enqueue", "Push", "Insert"], "Dequeue", "dequeue", "queue", "intermediate", "STACK_QUEUE_OPERATION_CONFUSION"),
    question("q23", "What does a Node's next reference usually point to?", ["The next node", "The array length", "The stack top only", "The first queue item always"], "The next node", "node", "linked_list", "foundation", "NODE_LINK_CONFUSION"),
    question("q24", "What is the first step when traversing a linked list?", ["Start at the head", "Pop the tail", "Enqueue the head", "Sort the nodes"], "Start at the head", "traversal", "linked_list", "foundation", "TRAVERSAL_CONFUSION"),
    question("q25", "Which structure gives direct access with an integer index?", ["Array", "Stack only", "Queue only", "Node"], "Array", "arrays", None, "foundation", "ARRAY_ACCESS_CONFUSION"),
    question("q26", "What happens when C is pushed after A and B on a stack?", ["C becomes the top", "A becomes the top", "The queue is emptied", "Nothing changes"], "C becomes the top", "push", "stack", "intermediate", "PUSH_POP_CONFUSION"),
    question("q27", "If a stack is empty, removing an item can cause what condition?", ["Underflow", "Overflow only", "Traversal", "Enqueue"], "Underflow", "pop", "stack", "advanced", "STACK_EMPTY_CONFUSION"),
    question("q28", "Which structure is best for a printer's first-come jobs?", ["Queue", "Stack", "Array index", "Node only"], "Queue", "queue", "fifo", "foundation", "STACK_QUEUE_OPERATION_CONFUSION"),
    question("q29", "Which structure models a browser Back button?", ["Stack", "Queue", "Array only", "FIFO line"], "Stack", "stack", "lifo", "intermediate", "STACK_QUEUE_OPERATION_CONFUSION"),
    question("q30", "Which pair correctly matches a structure and its principle?", ["Stack → LIFO", "Stack → FIFO", "Queue → LIFO", "Queue → random"], "Stack → LIFO", "stack", "lifo", "intermediate", "FIFO_LIFO_CONFUSION"),
    question("q31", "After enqueueing X and Y, which item is at the front of a queue?", ["X", "Y", "Neither", "The most recently popped"], "X", "queue", "fifo", "intermediate", "FIFO_LIFO_CONFUSION"),
    question("q32", "After pushing X and Y, which item is at the top of a stack?", ["X", "Y", "Neither", "The oldest queue item"], "Y", "stack", "lifo", "intermediate", "FIFO_LIFO_CONFUSION"),
]

ASSESSMENT_QUESTION_IDS = ["q08", "q09", "q10", "q11", "q12", "q15", "q16", "q17", "q18", "q20"]
PRACTICE_QUESTION_IDS = ["q09", "q10", "q30"]
RETEST_QUESTION_IDS = ["q11", "q29", "q32"]

QUESTION_BY_ID = {item["id"]: item for item in QUESTIONS}
CONCEPT_BY_ID = {item["id"]: item for item in CONCEPTS}