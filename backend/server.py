from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional, Dict, Any
import os
import logging
import uuid

from dotenv import load_dotenv
from fastapi import (
    FastAPI,
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from starlette.middleware.cors import CORSMiddleware
from bson import ObjectId


# ---------------------------------------------------------------------------
# Environment & DB setup
# ---------------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ.get("JWT_SECRET", "change_this_secret")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRES_MINUTES = int(os.environ.get("JWT_EXPIRES_MINUTES", "120"))

# ---------------------------------------------------------------------------
# App & Router
# ---------------------------------------------------------------------------
app = FastAPI(title="Student Skill Assistant API")
api_router = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Security / Auth helpers
# ---------------------------------------------------------------------------

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=JWT_EXPIRES_MINUTES)
    )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt


async def get_student_by_email(email: str) -> Optional[Dict[str, Any]]:
    return await db.students.find_one({"email": email})


async def get_student_by_id(student_id: str) -> Optional[Dict[str, Any]]:
    try:
        oid = ObjectId(student_id)
    except Exception:
        return None
    return await db.students.find_one({"_id": oid})


class TokenData(BaseModel):
    sub: Optional[str] = None
    email: Optional[EmailStr] = None


async def get_current_student(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        subject: str | None = payload.get("sub")
        email: str | None = payload.get("email")
        if subject is None or email is None:
            raise credentials_exception
        token_data = TokenData(sub=subject, email=email)
    except JWTError:
        raise credentials_exception

    student = await get_student_by_id(token_data.sub)
    if student is None:
        raise credentials_exception

    # normalize id to string for responses
    student["id"] = str(student["_id"])
    return student


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------


class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class StudentRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    branch: str
    semester: str


class StudentLogin(BaseModel):
    email: EmailStr
    password: str


class StudentPublic(BaseModel):
    id: str
    name: str
    email: EmailStr
    branch: str
    semester: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    student: StudentPublic


class QuestionPublic(BaseModel):
    id: str
    question: str
    options: List[str]


class AnswerSubmission(BaseModel):
    questionId: str
    optionIndex: int


class TestSubmitRequest(BaseModel):
    answers: List[AnswerSubmission]


class TestResultResponse(BaseModel):
    track: str
    score: int
    total: int
    percentage: float
    level: str
    message: str


class TrackLevel(BaseModel):
    level: Optional[str] = None
    percentage: Optional[float] = None


class LevelsResponse(BaseModel):
    webdev: Optional[TrackLevel] = None
    ml: Optional[TrackLevel] = None


class Course(BaseModel):
    id: str
    title: str
    platform: str
    url: str
    track: str
    difficulty: str


class RecommendationsResponse(BaseModel):
    webdev: List[Course]
    ml: List[Course]


class DocItem(BaseModel):
    id: str
    title: str
    track: str
    content: str
    code: Optional[str] = None


class DocCategory(BaseModel):
    id: str
    title: str
    items: List[DocItem]


class DocsResponse(BaseModel):
    categories: List[DocCategory]


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


# ---------------------------------------------------------------------------
# Static data: questions, courses, docs
# ---------------------------------------------------------------------------


WEBDEV_QUESTIONS_FULL = [
    {
        "id": "w1",
        "question": "What does HTML stand for?",
        "options": [
            "Hyper Trainer Marking Language",
            "Hyper Text Markup Language",
            "Hyper Text Marketing Language",
            "Hyperlinks Text Marking Language",
        ],
        "correctIndex": 1,
    },
    {
        "id": "w2",
        "question": "Which HTML tag is used to include JavaScript code?",
        "options": ["<javascript>", "<script>", "<js>", "<code>"],
        "correctIndex": 1,
    },
    {
        "id": "w3",
        "question": "Which CSS property controls text size?",
        "options": ["font-style", "text-size", "font-size", "text-style"],
        "correctIndex": 2,
    },
    {
        "id": "w4",
        "question": "Which HTTP method is typically used to submit form data?",
        "options": ["GET", "POST", "PUT", "DELETE"],
        "correctIndex": 1,
    },
    {
        "id": "w5",
        "question": "Which HTML element is used for the largest heading?",
        "options": ["<head>", "<h6>", "<h1>", "<title>"],
        "correctIndex": 2,
    },
    {
        "id": "w6",
        "question": "Which CSS layout module is best for creating one-dimensional layouts (rows or columns)?",
        "options": ["Grid", "Flexbox", "Float", "Positioning"],
        "correctIndex": 1,
    },
    {
        "id": "w7",
        "question": "In JavaScript, which keyword declares a block-scoped variable that can change?",
        "options": ["var", "let", "const", "static"],
        "correctIndex": 1,
    },
    {
        "id": "w8",
        "question": "What does CSS stand for?",
        "options": [
            "Computer Style Sheets",
            "Cascading Style Sheets",
            "Creative Style System",
            "Colorful Style Syntax",
        ],
        "correctIndex": 1,
    },
    {
        "id": "w9",
        "question": "Which of these is a valid HTTP status code for 'Not Found'?",
        "options": ["200", "301", "404", "500"],
        "correctIndex": 2,
    },
    {
        "id": "w10",
        "question": "Which tag creates a hyperlink in HTML?",
        "options": ["<a>", "<link>", "<href>", "<url>"],
        "correctIndex": 0,
    },
]


ML_QUESTIONS_FULL = [
    {
        "id": "m1",
        "question": "What is Machine Learning?",
        "options": [
            "Programming computers with explicit rules only",
            "A field where computers learn patterns from data",
            "Designing computer hardware",
            "Building websites with HTML and CSS",
        ],
        "correctIndex": 1,
    },
    {
        "id": "m2",
        "question": "Which of the following is a supervised learning task?",
        "options": [
            "Clustering customers by behavior",
            "Classifying emails as spam or not spam",
            "Finding topics in documents without labels",
            "Dimensionality reduction",
        ],
        "correctIndex": 1,
    },
    {
        "id": "m3",
        "question": "In linear regression, what do we typically minimize during training?",
        "options": [
            "Number of parameters",
            "Sum of squared errors between predictions and targets",
            "Number of data points",
            "Model accuracy",
        ],
        "correctIndex": 1,
    },
    {
        "id": "m4",
        "question": "Which of these is an example of a classification algorithm?",
        "options": [
            "K-Means",
            "Principal Component Analysis",
            "Logistic Regression",
            "K-Nearest Neighbors Regressor",
        ],
        "correctIndex": 2,
    },
    {
        "id": "m5",
        "question": "What does 'overfitting' mean in ML?",
        "options": [
            "Model is too simple and underperforms on both train and test",
            "Model performs well on train data but poorly on unseen test data",
            "Model has too few parameters",
            "Model cannot be trained at all",
        ],
        "correctIndex": 1,
    },
    {
        "id": "m6",
        "question": "Which of these is commonly used for dimensionality reduction?",
        "options": ["PCA", "SVM", "Random Forest", "Naive Bayes"],
        "correctIndex": 0,
    },
    {
        "id": "m7",
        "question": "What is a 'feature' in a dataset?",
        "options": [
            "A row in the dataset",
            "A column representing an input variable",
            "The final prediction",
            "The loss function",
        ],
        "correctIndex": 1,
    },
    {
        "id": "m8",
        "question": "Which library is widely used for building neural networks in Python?",
        "options": ["NumPy", "Pandas", "Matplotlib", "PyTorch"],
        "correctIndex": 3,
    },
    {
        "id": "m9",
        "question": "What is 'training data'?",
        "options": [
            "Data used to evaluate model performance",
            "Data used to tune hyperparameters",
            "Data used to learn model parameters",
            "Random noise added to inputs",
        ],
        "correctIndex": 2,
    },
    {
        "id": "m10",
        "question": "In classification, which metric measures the proportion of correct predictions?",
        "options": ["Loss", "Accuracy", "Learning rate", "Epoch"],
        "correctIndex": 1,
    },
]


COURSES: List[Dict[str, Any]] = [
    # Web Dev - Beginner
    {
        "id": "c-w-b-1",
        "title": "HTML & CSS Crash Course",
        "platform": "YouTube",
        "url": "https://www.youtube.com/results?search_query=html+css+crash+course",
        "track": "webdev",
        "difficulty": "Beginner",
    },
    {
        "id": "c-w-b-2",
        "title": "Web Development for Beginners",
        "platform": "freeCodeCamp",
        "url": "https://www.freecodecamp.org/learn/",
        "track": "webdev",
        "difficulty": "Beginner",
    },
    # Web Dev - Intermediate
    {
        "id": "c-w-i-1",
        "title": "Modern JavaScript Tutorial",
        "platform": "MDN / Docs",
        "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide",
        "track": "webdev",
        "difficulty": "Intermediate",
    },
    {
        "id": "c-w-i-2",
        "title": "React for Beginners",
        "platform": "Scrimba / YouTube",
        "url": "https://www.youtube.com/results?search_query=react+js+for+beginners",
        "track": "webdev",
        "difficulty": "Intermediate",
    },
    # Web Dev - Advanced
    {
        "id": "c-w-a-1",
        "title": "Full-Stack Web Development Projects",
        "platform": "Udemy / Other",
        "url": "https://www.udemy.com/topic/web-development/",
        "track": "webdev",
        "difficulty": "Advanced",
    },
    {
        "id": "c-w-a-2",
        "title": "Web Performance Optimization",
        "platform": "Web.dev",
        "url": "https://web.dev/fast/",
        "track": "webdev",
        "difficulty": "Advanced",
    },
    # ML - Beginner
    {
        "id": "c-m-b-1",
        "title": "Machine Learning for Beginners",
        "platform": "YouTube",
        "url": "https://www.youtube.com/results?search_query=machine+learning+for+beginners",
        "track": "ml",
        "difficulty": "Beginner",
    },
    {
        "id": "c-m-b-2",
        "title": "Intro to ML with Python",
        "platform": "Kaggle / Courses",
        "url": "https://www.kaggle.com/learn/intro-to-machine-learning",
        "track": "ml",
        "difficulty": "Beginner",
    },
    # ML - Intermediate
    {
        "id": "c-m-i-1",
        "title": "Supervised Machine Learning",
        "platform": "Coursera",
        "url": "https://www.coursera.org/specializations/machine-learning-introduction",
        "track": "ml",
        "difficulty": "Intermediate",
    },
    {
        "id": "c-m-i-2",
        "title": "Hands-On ML with Scikit-Learn",
        "platform": "Book / Online",
        "url": "https://www.oreilly.com/library/view/hands-on-machine-learning/9781492032632/",
        "track": "ml",
        "difficulty": "Intermediate",
    },
    # ML - Advanced
    {
        "id": "c-m-a-1",
        "title": "Deep Learning Specialization",
        "platform": "Coursera",
        "url": "https://www.coursera.org/specializations/deep-learning",
        "track": "ml",
        "difficulty": "Advanced",
    },
    {
        "id": "c-m-a-2",
        "title": "Advanced ML on Google Cloud",
        "platform": "Coursera",
        "url": "https://www.coursera.org/specializations/advanced-machine-learning-tensorflow-gcp",
        "track": "ml",
        "difficulty": "Advanced",
    },
]


DOC_CATEGORIES: List[Dict[str, Any]] = [
    {
        "id": "webdev",
        "title": "Web Development",
        "items": [
            {
                "id": "html-basics",
                "title": "HTML Basics",
                "track": "webdev",
                "content": "HTML (HyperText Markup Language) is the standard language for creating web pages. It uses elements represented by tags like <h1>, <p>, and <a> to describe the structure of a document.",
                "code": "<!DOCTYPE html>\n<html>\n  <head>\n    <title>My First Page</title>\n  </head>\n  <body>\n    <h1>Hello, world!</h1>\n    <p>This is my first web page.</p>\n  </body>\n</html>",
            },
            {
                "id": "css-basics",
                "title": "CSS Basics",
                "track": "webdev",
                "content": "CSS (Cascading Style Sheets) is used to style HTML. You can change colors, layout, fonts, spacing, and more.",
                "code": "h1 {\n  color: #1f2937;\n  font-size: 2rem;\n}\n\np {\n  line-height: 1.6;\n}",
            },
            {
                "id": "js-basics",
                "title": "JavaScript Basics",
                "track": "webdev",
                "content": "JavaScript adds interactivity to web pages. You can respond to user actions, modify the DOM, and call backend APIs.",
                "code": "const button = document.querySelector('button');\nbutton.addEventListener('click', () => {\n  alert('Button clicked!');\n});",
            },
        ],
    },
    {
        "id": "ml",
        "title": "Machine Learning",
        "items": [
            {
                "id": "what-is-ml",
                "title": "What is Machine Learning?",
                "track": "ml",
                "content": "Machine Learning is a field of AI where algorithms learn patterns from data instead of being explicitly programmed with rules.",
            },
            {
                "id": "types-of-ml",
                "title": "Types of Machine Learning",
                "track": "ml",
                "content": "Common types of ML include supervised learning, unsupervised learning, and reinforcement learning.",
            },
            {
                "id": "ml-workflow",
                "title": "Basic ML Workflow",
                "track": "ml",
                "content": "A typical ML workflow: define the problem, collect data, preprocess data, choose a model, train, evaluate, and deploy.",
            },
        ],
    },
]


# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------


def map_percentage_to_level(percentage: float) -> str:
    if percentage <= 40:
        return "Beginner"
    if percentage <= 75:
        return "Intermediate"
    return "Advanced"


async def get_latest_levels_for_student(student_id: ObjectId) -> LevelsResponse:
    levels: Dict[str, TrackLevel] = {}
    cursor = db.test_results.find({"student_id": student_id}).sort("submitted_at", -1)
    async for doc in cursor:
        track = doc.get("track")
        if track in levels:
            continue
        levels[track] = TrackLevel(level=doc.get("level"), percentage=doc.get("percentage"))

    return LevelsResponse(webdev=levels.get("webdev"), ml=levels.get("ml"))


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@api_router.get("/")
async def root() -> Dict[str, str]:
    return {"message": "Student Skill Assistant API"}


# Health status demo (kept from starter)
@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(client_name=input.client_name)
    doc = status_obj.model_dump()
    doc["timestamp"] = doc["timestamp"].isoformat()
    await db.status_checks.insert_one(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check["timestamp"], str):
            check["timestamp"] = datetime.fromisoformat(check["timestamp"])
    return status_checks


# ---------------------------- Auth Endpoints ------------------------------


@api_router.post("/auth/register", response_model=StudentPublic, status_code=201)
async def register_student(payload: StudentRegister):
    existing = await get_student_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(payload.password)
    doc = {
        "name": payload.name,
        "email": payload.email,
        "password_hash": hashed_password,
        "branch": payload.branch,
        "semester": payload.semester,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.students.insert_one(doc)
    student_public = StudentPublic(
        id=str(result.inserted_id),
        name=payload.name,
        email=payload.email,
        branch=payload.branch,
        semester=payload.semester,
    )
    return student_public


@api_router.post("/auth/login", response_model=TokenResponse)
async def login_student(payload: StudentLogin):
    student = await get_student_by_email(payload.email)
    if not student or not verify_password(payload.password, student.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    student_id = str(student["_id"])
    access_token = create_access_token({"sub": student_id, "email": student["email"]})
    student_public = StudentPublic(
        id=student_id,
        name=student["name"],
        email=student["email"],
        branch=student["branch"],
        semester=student["semester"],
    )
    return TokenResponse(access_token=access_token, student=student_public)


# ---------------------------- Tests Endpoints -----------------------------


@api_router.get("/tests/{track}", response_model=Dict[str, Any])
async def get_test_questions(track: str, _: Dict[str, Any] = Depends(get_current_student)):
    if track not in {"webdev", "ml"}:
        raise HTTPException(status_code=404, detail="Unknown track")

    questions_full = WEBDEV_QUESTIONS_FULL if track == "webdev" else ML_QUESTIONS_FULL
    questions_public = [
        QuestionPublic(id=q["id"], question=q["question"], options=q["options"]).model_dump()
        for q in questions_full
    ]
    return {"track": track, "questions": questions_public}


@api_router.post("/tests/{track}", response_model=TestResultResponse)
async def submit_test(
    track: str,
    payload: TestSubmitRequest,
    current_student: Dict[str, Any] = Depends(get_current_student),
):
    if track not in {"webdev", "ml"}:
        raise HTTPException(status_code=404, detail="Unknown track")

    questions_full = WEBDEV_QUESTIONS_FULL if track == "webdev" else ML_QUESTIONS_FULL
    question_map = {q["id"]: q for q in questions_full}

    score = 0
    total = len(questions_full)

    for ans in payload.answers:
        q = question_map.get(ans.questionId)
        if not q:
            continue
        if ans.optionIndex == q["correctIndex"]:
            score += 1

    percentage = (score / total) * 100 if total > 0 else 0.0
    level = map_percentage_to_level(percentage)

    doc = {
        "student_id": ObjectId(current_student["id"]),
        "track": track,
        "score": score,
        "total": total,
        "percentage": percentage,
        "level": level,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.test_results.insert_one(doc)

    # Simple messages based on level
    if level == "Beginner":
        message = "You are at Beginner level. Focus on the basics and build strong foundations."
    elif level == "Intermediate":
        message = "Nice work! You are at Intermediate level. Keep practicing and build projects."
    else:
        message = "Great job! You are at Advanced level. Explore deeper topics and real-world applications."

    return TestResultResponse(
        track=track,
        score=score,
        total=total,
        percentage=round(percentage, 2),
        level=level,
        message=message,
    )


@api_router.get("/tests/levels", response_model=LevelsResponse)
async def get_levels(current_student: Dict[str, Any] = Depends(get_current_student)):
    student_id = ObjectId(current_student["id"])
    return await get_latest_levels_for_student(student_id)


# ------------------------ Recommendations Endpoint ------------------------


@api_router.get("/recommendations", response_model=RecommendationsResponse)
async def get_recommendations(current_student: Dict[str, Any] = Depends(get_current_student)):
    student_id = ObjectId(current_student["id"])
    levels = await get_latest_levels_for_student(student_id)

    def filter_courses(track: str, level: Optional[TrackLevel]) -> List[Course]:
        target_difficulty = level.level if level and level.level else "Beginner"
        filtered = [
            Course(**course)
            for course in COURSES
            if course["track"] == track and course["difficulty"] == target_difficulty
        ]
        return filtered

    return RecommendationsResponse(
        webdev=filter_courses("webdev", levels.webdev),
        ml=filter_courses("ml", levels.ml),
    )


# ----------------------------- Docs Endpoint ------------------------------


@api_router.get("/docs", response_model=DocsResponse)
async def get_docs(_: Dict[str, Any] = Depends(get_current_student)):
    categories = [DocCategory(**cat) for cat in DOC_CATEGORIES]
    return DocsResponse(categories=categories)


# ----------------------------- Chat Endpoint ------------------------------


@api_router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(payload: ChatRequest, _: Dict[str, Any] = Depends(get_current_student)):
    text = payload.message.lower()

    if "html" in text:
        reply = "HTML (HyperText Markup Language) defines the structure of web pages using elements like headings, paragraphs, links, and more. Start by learning the basic tags such as <h1>, <p>, <a>, and <div>."
    elif "css" in text:
        reply = "CSS (Cascading Style Sheets) is used to style HTML. Focus on selectors, the box model, flexbox, and grid to build responsive layouts."
    elif "javascript" in text or "js" in text:
        reply = "JavaScript makes your web pages interactive. Begin with variables, functions, arrays, objects, and DOM manipulation."
    elif "machine learning" in text or "ml" in text:
        reply = "Machine Learning is about learning patterns from data. Start with supervised learning (like regression and classification) before moving to deep learning."
    elif "web" in text and "development" in text:
        reply = "For web development, master HTML, CSS, and JavaScript first, then explore a framework like React. Build small projects like a todo app or portfolio site."
    else:
        reply = "I am a simple assistant. In the future, I will be powered by a real ML model, but for now I can give short tips about HTML, CSS, JavaScript, and Machine Learning."

    return ChatResponse(reply=reply)


# ---------------------------------------------------------------------------
# Mount router, middleware, logging, shutdown
# ---------------------------------------------------------------------------


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
