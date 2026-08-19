import pymongo
from datetime import datetime

client = pymongo.MongoClient("mongodb://localhost:27017")
db = client["gre_db"]

awa_rows = [
    ("AWA_ISS_001", "AWA Issue", "Medium", "Educational institutions should make all courses optional for college students. Discuss the extent to which you agree or disagree with this statement.", "Analyze student autonomy versus curriculum structure."),
    ("AWA_ARG_002", "AWA Argument", "Hard", 'The following appeared in a memo from a company vice president: "Our sales rose by 20% after implementing remote work, so all employees should work remotely." Discuss the logical flaws.', "Identify flaws in causal link between remote work and sales increase."),
    ("AWA_ISS_003", "AWA Issue", "Easy", "Governments should place higher priority on funding basic scientific research than on applied scientific research. Discuss your views.", "Compare long-term foundational discovery vs immediate practical application."),
    ("AWA_ARG_004", "AWA Argument", "Medium", 'The following appeared in a health journal: "People who drink green tea daily report lower stress. Therefore, green tea cures anxiety." Evaluate the argument.', "Address correlation vs causation fallacy."),
    ("AWA_ISS_005", "AWA Issue", "Hard", "True greatness in any field can only be recognized long after a person's era has passed. Discuss the extent to which you agree.", "Examine historical consensus vs contemporary recognition."),
    ("AWA_ARG_006", "AWA Argument", "Easy", 'A city official claims: "Installing traffic cameras reduced accidents by 15% on Main Street, so we should install them on all streets." Evaluate the recommendation.', "Consider sample bias and specific street characteristics."),
    ("AWA_ISS_007", "AWA Issue", "Medium", "In order to be an effective leader, a public official must maintain strict moral standards in private life. Discuss your perspective.", "Explore private morality vs public competence."),
    ("AWA_ARG_008", "AWA Argument", "Hard", 'The president of a gym chain asserts: "Adding sauna rooms in Branch A doubled memberships, so adding saunas in all branches will double total revenue." Evaluate.', "Identify false generalization across different locations."),
    ("AWA_ISS_009", "AWA Issue", "Easy", "Formal education should primarily focus on preparing students for specific careers rather than providing general knowledge. Discuss.", "Debate vocational specialization vs liberal arts breadth."),
    ("AWA_ARG_010", "AWA Argument", "Medium", 'A housing board report states: "Rent prices in Westville dropped 10% after building 500 apartments. Building 500 more will reduce prices by another 10%." Evaluate.', "Examine diminishing returns and supply-demand equilibrium.")
]

db.awa_questions.delete_many({"question_id": {"$regex": "^AWA_"}})

docs = []
for qid, cat, level, text, exp in awa_rows:
    doc = {
        "question_id": qid,
        "subject": "AWA",
        "category": cat,
        "level": level,
        "question_type": "AWA",
        "answer_format": "ESSAY",
        "is_multi_answer": False,
        "question_text": text,
        "passage": "",
        "options": [],
        "correct_answers": [{"value": "N/A", "format": "LABEL", "option_label": "N/A"}],
        "explanation": exp,
        "images": [],
        "has_answer_image": False,
        "image_storage": "S3",
        "is_active": True,
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    docs.append(doc)

res = db.awa_questions.insert_many(docs)
print("Successfully populated awa_questions collection with:", len(res.inserted_ids), "AWA prompts!")
