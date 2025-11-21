import React, { useEffect, useMemo, useState, createContext, useContext } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "@/App.css";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// ---------------------------------------------------------------------------
// Axios instance with auth interceptor
// ---------------------------------------------------------------------------

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = window.localStorage.getItem("ssa_token");
  if (token) {
    // eslint-disable-next-line no-param-reassign
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      window.localStorage.removeItem("ssa_token");
      window.localStorage.removeItem("ssa_student");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// Auth context
// ---------------------------------------------------------------------------

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [student, setStudent] = useState(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("ssa_student");
    if (stored) {
      try {
        setStudent(JSON.parse(stored));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Failed to parse stored student", e);
      }
    }
  }, []);

  const login = (token, studentData) => {
    window.localStorage.setItem("ssa_token", token);
    window.localStorage.setItem("ssa_student", JSON.stringify(studentData));
    setStudent(studentData);
  };

  const logout = () => {
    window.localStorage.removeItem("ssa_token");
    window.localStorage.removeItem("ssa_student");
    setStudent(null);
  };

  const value = useMemo(() => ({ student, login, logout }), [student]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  return useContext(AuthContext);
}

// ---------------------------------------------------------------------------
// Layout & Route guards
// ---------------------------------------------------------------------------

function AppLayout({ children }) {
  const { student, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app-root">
      <div className="app-shell">
        <nav className="app-nav" data-testid="app-navbar">
          <div className="app-nav-title">
            <span className="app-nav-title-main" data-testid="navbar-title-main">
              Student Skill Assistant
            </span>
            <span className="app-nav-title-sub" data-testid="navbar-title-sub">
              Find your level. Grow your skills.
            </span>
          </div>

          <div className="app-nav-actions">
            {student ? (
              <>
                <div className="app-nav-user" data-testid="navbar-user-info">
                  <span className="app-nav-user-name">{student.name}</span>
                  <span className="app-nav-user-meta">
                    {student.branch} · Sem {student.semester}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  data-testid="navbar-logout-button"
                >
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/login")}
                  data-testid="navbar-login-button"
                >
                  Login
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate("/register")}
                  data-testid="navbar-register-button"
                >
                  Get started
                </Button>
              </>
            )}
          </div>
        </nav>

        <main className="app-main">{children}</main>

        <p className="app-footer-note" data-testid="app-footer-note">
          Built for B.Tech students – practice tests, curated courses, quick docs & a simple chat
          assistant.
        </p>
      </div>
      <Toaster />
    </div>
  );
}

function RequireAuth({ children }) {
  const { student } = useAuth();
  const location = useLocation();
  const token = window.localStorage.getItem("ssa_token");

  if (!student || !token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

// ---------------------------------------------------------------------------
// Pages – Auth
// ---------------------------------------------------------------------------

function RegisterPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    branch: "",
    semester: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.branch || !form.semester) {
      toast({
        title: "Missing fields",
        description: "Please fill in all the details.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/register", form);
      toast({
        title: "Registration successful",
        description: "You can now log in with your credentials.",
      });
      navigate("/login");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      toast({
        title: "Registration failed",
        description:
          error?.response?.data?.detail || "Something went wrong while creating your account.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section data-testid="register-page">
      <div className="app-page-header">
        <h1 className="app-page-title" data-testid="register-page-title">
          Create your student account
        </h1>
        <p className="app-page-description" data-testid="register-page-description">
          Register once to track your levels, get recommendations, and revisit your learning
          history.
        </p>
      </div>

      <Card data-testid="register-card">
        <CardHeader>
          <CardTitle data-testid="register-card-title">Student details</CardTitle>
          <CardDescription data-testid="register-card-description">
            Use your college email if possible so you can access it across devices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="register-form">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Ananya Sharma"
                  data-testid="register-name-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@college.edu"
                  data-testid="register-email-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="branch">Branch</Label>
                <Input
                  id="branch"
                  name="branch"
                  value={form.branch}
                  onChange={handleChange}
                  placeholder="e.g. CSE, ECE"
                  data-testid="register-branch-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="semester">Semester</Label>
                <Input
                  id="semester"
                  name="semester"
                  value={form.semester}
                  onChange={handleChange}
                  placeholder="e.g. 3"
                  data-testid="register-semester-input"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Create a strong password"
                data-testid="register-password-input"
              />
            </div>
            <div className="pt-2 flex items-center justify-between gap-3 flex-wrap">
              <Button
                type="submit"
                disabled={loading}
                data-testid="register-submit-button"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="loader-spinner" />
                    Creating account...
                  </span>
                ) : (
                  "Create account"
                )}
              </Button>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="text-xs text-slate-600 hover:text-slate-900"
                data-testid="register-login-link"
              >
                Already registered? Log in
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}

function LoginPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast({
        title: "Missing fields",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/login", form);
      login(res.data.access_token, res.data.student);
      toast({ title: "Welcome back", description: "Logged in successfully." });
      const from = location.state?.from?.pathname || "/dashboard";
      navigate(from, { replace: true });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      toast({
        title: "Login failed",
        description: error?.response?.data?.detail || "Invalid credentials.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section data-testid="login-page">
      <div className="app-page-header">
        <h1 className="app-page-title" data-testid="login-page-title">
          Log in to continue
        </h1>
        <p className="app-page-description" data-testid="login-page-description">
          Access your dashboard, view your latest levels, and continue where you left off.
        </p>
      </div>

      <Card data-testid="login-card">
        <CardHeader>
          <CardTitle data-testid="login-card-title">Welcome back</CardTitle>
          <CardDescription data-testid="login-card-description">
            Use the same email you registered with Student Skill Assistant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@college.edu"
                data-testid="login-email-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Your password"
                data-testid="login-password-input"
              />
            </div>
            <div className="pt-1 flex items-center justify-between gap-3 flex-wrap">
              <Button
                type="submit"
                disabled={loading}
                data-testid="login-submit-button"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="loader-spinner" />
                    Logging in...
                  </span>
                ) : (
                  "Log in"
                )}
              </Button>
              <button
                type="button"
                onClick={() => navigate("/register")}
                className="text-xs text-slate-600 hover:text-slate-900"
                data-testid="login-register-link"
              >
                New here? Create an account
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function LevelPill({ level }) {
  if (!level) {
    return (
      <span className="level-pill level-pill-beginner" data-testid="level-pill-unknown">
        Not evaluated yet
      </span>
    );
  }
  const norm = level.toLowerCase();
  const className =
    norm === "beginner"
      ? "level-pill level-pill-beginner"
      : norm === "intermediate"
        ? "level-pill level-pill-intermediate"
        : "level-pill level-pill-advanced";
  return (
    <span className={className} data-testid={`level-pill-${norm}`}>
      {level}
    </span>
  );
}

function DashboardPage() {
  const { student } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [levels, setLevels] = useState({ webdev: null, ml: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLevels = async () => {
      try {
        const res = await api.get("/tests/levels");
        setLevels(res.data);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
        toast({
          title: "Could not load levels",
          description: "You can still take tests, and we will compute them.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchLevels();
  }, [toast]);

  return (
    <section data-testid="dashboard-page">
      <div className="app-page-header">
        <h1 className="app-page-title" data-testid="dashboard-page-title">
          Welcome, {student?.name}
        </h1>
        <p className="app-page-description" data-testid="dashboard-page-description">
          Track your Web Development & Machine Learning levels, then jump straight into curated
          courses and quick docs.
        </p>
      </div>

      <div className="app-grid-two mb-4">
        <Card data-testid="dashboard-webdev-card">
          <CardHeader>
            <CardTitle>Web Development</CardTitle>
            <CardDescription>HTML, CSS, JavaScript, and basic web concepts.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-slate-500 uppercase tracking-[0.18em]">Current level</p>
              {loading ? (
                <div className="loader-spinner" data-testid="dashboard-webdev-level-loading" />
              ) : (
                <LevelPill level={levels.webdev?.level} />
              )}
              {!loading && levels.webdev?.percentage !== undefined && (
                <p className="text-xs text-slate-500" data-testid="dashboard-webdev-percentage">
                  Last score: {Math.round(levels.webdev.percentage)}%
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={() => navigate("/tests/webdev")}
                data-testid="dashboard-webdev-test-button"
              >
                Take Web Dev Test
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="dashboard-ml-card">
          <CardHeader>
            <CardTitle>Machine Learning</CardTitle>
            <CardDescription>
              Supervised, unsupervised learning and basic ML terminology.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-slate-500 uppercase tracking-[0.18em]">Current level</p>
              {loading ? (
                <div className="loader-spinner" data-testid="dashboard-ml-level-loading" />
              ) : (
                <LevelPill level={levels.ml?.level} />
              )}
              {!loading && levels.ml?.percentage !== undefined && (
                <p className="text-xs text-slate-500" data-testid="dashboard-ml-percentage">
                  Last score: {Math.round(levels.ml.percentage)}%
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={() => navigate("/tests/ml")}
                data-testid="dashboard-ml-test-button"
              >
                Take ML Test
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4" data-testid="dashboard-actions-card">
        <CardHeader>
          <CardTitle>What would you like to do next?</CardTitle>
          <CardDescription>
            Jump straight into practice, browse curated courses, or quickly revise concepts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate("/recommendations")}
              data-testid="dashboard-recommendations-button"
            >
              View Course Recommendations
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/docs")}
              data-testid="dashboard-docs-button"
            >
              Open Docs
            </Button>
            <Button
              onClick={() => navigate("/chat")}
              data-testid="dashboard-chat-button"
            >
              Open Chat Assistant
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tests pages
// ---------------------------------------------------------------------------

function TestPage({ track }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/tests/${track}`);
        setQuestions(res.data.questions || []);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
        toast({
          title: "Could not load test questions",
          description: "Please try again in a moment.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [track, toast]);

  const handleOptionChange = (questionId, optionIndex) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (questions.length === 0) return;

    const payload = {
      answers: questions.map((q) => ({
        questionId: q.id,
        optionIndex: typeof answers[q.id] === "number" ? answers[q.id] : -1,
      })),
    };

    setSubmitting(true);
    try {
      const res = await api.post(`/tests/${track}`, payload);
      navigate(`/tests/result/${track}`, { state: { result: res.data } });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      toast({
        title: "Could not submit test",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const title = track === "webdev" ? "Web Development Test" : "Machine Learning Test";

  return (
    <section data-testid={`test-page-${track}`}>
      <div className="app-page-header">
        <h1 className="app-page-title" data-testid="test-page-title">
          {title}
        </h1>
        <p className="app-page-description" data-testid="test-page-description">
          Answer all questions. Your score will map to Beginner, Intermediate, or Advanced.
        </p>
      </div>

      <Card data-testid="test-card">
        <CardHeader>
          <CardTitle>Multiple-choice questions</CardTitle>
          <CardDescription>Each question has exactly one correct option.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-3" data-testid="test-loading">
              <span className="loader-spinner" />
              <span className="text-sm text-slate-600">Loading questions...</span>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-6"
              data-testid="test-form"
            >
              {questions.map((q, index) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-slate-200/80 bg-white p-4"
                  data-testid={`test-question-${index + 1}`}
                >
                  <p className="mb-3 text-sm font-medium text-slate-800">
                    Q{index + 1}. {q.question}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {q.options.map((opt, optIndex) => {
                      const inputId = `${q.id}-${optIndex}`;
                      return (
                        <label
                          key={optId}
                          htmlFor={inputId}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2 text-sm hover:border-slate-300"
                          data-testid={`test-option-${q.id}-${optIndex}`}
                        >
                          <input
                            id={inputId}
                            type="radio"
                            name={q.id}
                            value={optIndex}
                            checked={answers[q.id] === optIndex}
                            onChange={() => handleOptionChange(q.id, optIndex)}
                            className="h-3.5 w-3.5 accent-slate-900"
                            data-testid={`test-option-input-${q.id}-${optIndex}`}
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="pt-2 flex items-center justify-between gap-3 flex-wrap">
                <Button
                  type="submit"
                  disabled={submitting}
                  data-testid="test-submit-button"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="loader-spinner" />
                      Submitting test...
                    </span>
                  ) : (
                    "Submit Test"
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="text-xs text-slate-600 hover:text-slate-900"
                  data-testid="test-back-dashboard-link"
                >
                  Back to dashboard
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Test result page
// ---------------------------------------------------------------------------

function TestResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname } = location;
  const track = pathname.split("/").pop();
  const result = location.state?.result;

  if (!result) {
    return <Navigate to="/dashboard" replace />;
  }

  const title = track === "webdev" ? "Web Development" : "Machine Learning";

  return (
    <section data-testid="test-result-page">
      <div className="app-page-header">
        <h1 className="app-page-title" data-testid="test-result-title">
          {title} – Result
        </h1>
        <p className="app-page-description" data-testid="test-result-description">
          Here is a quick summary of your performance in this attempt.
        </p>
      </div>

      <Card data-testid="test-result-card">
        <CardHeader>
          <CardTitle>Your level in this track</CardTitle>
          <CardDescription>{result.message}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1" data-testid="test-result-score">
            <p className="text-xs text-slate-500 uppercase tracking-[0.18em]">Score</p>
            <p className="text-xl font-semibold text-slate-900">
              {result.score} / {result.total}
            </p>
          </div>
          <div className="space-y-1" data-testid="test-result-percentage">
            <p className="text-xs text-slate-500 uppercase tracking-[0.18em]">Percentage</p>
            <p className="text-xl font-semibold text-slate-900">{result.percentage}%</p>
          </div>
          <div className="space-y-1" data-testid="test-result-level">
            <p className="text-xs text-slate-500 uppercase tracking-[0.18em]">Detected level</p>
            <LevelPill level={result.level} />
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-slate-500 max-w-xs" data-testid="test-result-tip">
            You can retake the test at any time. Only the latest score is shown on your dashboard.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              data-testid="test-result-dashboard-button"
            >
              Back to dashboard
            </Button>
            <Button
              onClick={() => navigate("/recommendations")}
              data-testid="test-result-recommendations-button"
            >
              View course recommendations
            </Button>
          </div>
        </CardFooter>
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Recommendations page
// ---------------------------------------------------------------------------

function RecommendationsPage() {
  const { toast } = useToast();
  const [data, setData] = useState({ webdev: [], ml: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const res = await api.get("/recommendations");
        setData(res.data);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
        toast({
          title: "Could not load recommendations",
          description: "Try again after completing at least one test.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [toast]);

  return (
    <section data-testid="recommendations-page">
      <div className="app-page-header">
        <h1 className="app-page-title" data-testid="recommendations-title">
          Course recommendations
        </h1>
        <p className="app-page-description" data-testid="recommendations-description">
          Based on your latest levels, here are curated learning paths for each track.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-3" data-testid="recommendations-loading">
          <span className="loader-spinner" />
          <span className="text-sm text-slate-600">Loading recommendations...</span>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2
                className="text-sm font-semibold text-slate-900 tracking-tight"
                data-testid="recommendations-webdev-heading"
              >
                Web Development
              </h2>
              <Badge variant="outline" data-testid="recommendations-webdev-count-badge">
                {data.webdev.length} course(s)
              </Badge>
            </div>
            {data.webdev.length === 0 ? (
              <p className="text-xs text-slate-500" data-testid="recommendations-webdev-empty">
                No web development recommendations yet. Take the Web Dev test to unlock them.
              </p>
            ) : (
              <div className="app-grid-two">
                {data.webdev.map((course) => (
                  <Card
                    key={course.id}
                    data-testid={`recommendations-webdev-course-${course.id}`}
                  >
                    <CardHeader>
                      <CardTitle className="text-base">{course.title}</CardTitle>
                      <CardDescription>
                        <span className="text-xs text-slate-500">{course.platform}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardFooter className="flex items-center justify-between">
                      <Badge
                        variant="secondary"
                        data-testid={`recommendations-webdev-course-difficulty-${course.id}`}
                      >
                        {course.difficulty}
                      </Badge>
                      <Button
                        asChild
                        size="sm"
                        data-testid={`recommendations-webdev-open-button-${course.id}`}
                      >
                        <a href={course.url} target="_blank" rel="noreferrer">
                          Open course
                        </a>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h2
                className="text-sm font-semibold text-slate-900 tracking-tight"
                data-testid="recommendations-ml-heading"
              >
                Machine Learning
              </h2>
              <Badge variant="outline" data-testid="recommendations-ml-count-badge">
                {data.ml.length} course(s)
              </Badge>
            </div>
            {data.ml.length === 0 ? (
              <p className="text-xs text-slate-500" data-testid="recommendations-ml-empty">
                No machine learning recommendations yet. Take the ML test to unlock them.
              </p>
            ) : (
              <div className="app-grid-two">
                {data.ml.map((course) => (
                  <Card
                    key={course.id}
                    data-testid={`recommendations-ml-course-${course.id}`}
                  >
                    <CardHeader>
                      <CardTitle className="text-base">{course.title}</CardTitle>
                      <CardDescription>
                        <span className="text-xs text-slate-500">{course.platform}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardFooter className="flex items-center justify-between">
                      <Badge
                        variant="secondary"
                        data-testid={`recommendations-ml-course-difficulty-${course.id}`}
                      >
                        {course.difficulty}
                      </Badge>
                      <Button
                        asChild
                        size="sm"
                        data-testid={`recommendations-ml-open-button-${course.id}`}
                      >
                        <a href={course.url} target="_blank" rel="noreferrer">
                          Open course
                        </a>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Docs page
// ---------------------------------------------------------------------------

function DocsPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await api.get("/docs");
        const cats = res.data.categories || [];
        setCategories(cats);
        if (cats.length > 0 && cats[0].items?.length > 0) {
          setSelected(cats[0].items[0]);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
        toast({
          title: "Could not load docs",
          description: "Please try again later.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDocs();
  }, [toast]);

  const handleSelect = (item) => {
    setSelected(item);
  };

  return (
    <section data-testid="docs-page">
      <div className="app-page-header">
        <h1 className="app-page-title" data-testid="docs-title">
          Quick docs
        </h1>
        <p className="app-page-description" data-testid="docs-description">
          A tiny, focused reference for the exact topics you need while studying or building.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-3" data-testid="docs-loading">
          <span className="loader-spinner" />
          <span className="text-sm text-slate-600">Loading docs...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="md:col-span-1" data-testid="docs-sidebar-card">
            <CardHeader>
              <CardTitle className="text-sm">Topics</CardTitle>
              <CardDescription>Select a topic to read its explanation.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[360px] pr-2" data-testid="docs-sidebar-scroll">
                <div className="space-y-4">
                  {categories.map((cat) => (
                    <div key={cat.id} className="space-y-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.18em]">
                        {cat.title}
                      </p>
                      <div className="space-y-1.5">
                        {cat.items.map((item) => {
                          const isActive = selected?.id === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleSelect(item)}
                              className={`w-full text-left docs-sidebar-item ${isActive ? "docs-sidebar-item-active" : "docs-sidebar-item-inactive"}`}
                              data-testid={`docs-sidebar-item-${item.id}`}
                            >
                              <span className="docs-sidebar-item-label">
                                <span className="docs-sidebar-item-title">{item.title}</span>
                                <span className="docs-sidebar-item-track">{item.track}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="md:col-span-2" data-testid="docs-content-card">
            <CardHeader>
              <CardTitle className="text-base" data-testid="docs-content-title">
                {selected?.title || "Select a topic"}
              </CardTitle>
              {selected && (
                <CardDescription data-testid="docs-content-track">
                  Track: <span className="font-medium text-slate-800">{selected.track}</span>
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4" data-testid="docs-content-body">
              {selected ? (
                <>
                  <p className="text-sm leading-relaxed text-slate-700">{selected.content}</p>
                  {selected.code && (
                    <pre className="docs-code" data-testid="docs-content-code">
                      <code>{selected.code}</code>
                    </pre>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">Choose a topic from the left to start.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Chat page
// ---------------------------------------------------------------------------

function ChatPage() {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "m-1",
      role: "assistant",
      content:
        "Hi! I am a simple assistant. Ask me about HTML, CSS, JavaScript, or Machine Learning.",
    },
  ]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input.trim();

    const userMessage = { id: `u-${Date.now()}`, role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      const res = await api.post("/chat", { message: text });
      const replyMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: res.data.reply,
      };
      setMessages((prev) => [...prev, replyMessage]);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      toast({
        title: "Chat error",
        description: "Unable to get a reply right now.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <section data-testid="chat-page">
      <div className="app-page-header">
        <h1 className="app-page-title" data-testid="chat-title">
          Chat assistant
        </h1>
        <p className="app-page-description" data-testid="chat-description">
          This is a simple, rule-based assistant today – but the interface is ready for a real ML
          model later.
        </p>
      </div>

      <Card data-testid="chat-card">
        <CardHeader>
          <CardTitle className="text-base">Ask anything</CardTitle>
          <CardDescription>Keep your questions short and focused on concepts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="chat-history" data-testid="chat-history">
            <div className="space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className="chat-message"
                  data-testid={`chat-message-${m.role}`}
                >
                  <span className="chat-message-role text-slate-400">
                    {m.role === "user" ? "You" : "Assistant"}
                  </span>
                  <div
                    className={`chat-bubble ${m.role === "user" ? "chat-bubble-user" : "chat-bubble-assistant"}`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="chat-input-row" data-testid="chat-input-row">
            <Textarea
              rows={2}
              placeholder="Ask about HTML, CSS, JavaScript, ML..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              data-testid="chat-input-textarea"
            />
            <Button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              data-testid="chat-send-button"
            >
              {sending ? (
                <span className="inline-flex items-center gap-2">
                  <span className="loader-spinner" />
                  Sending...
                </span>
              ) : (
                "Send"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Root App & Routes
// ---------------------------------------------------------------------------

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/register"
        element={
          <AppLayout>
            <RegisterPage />
          </AppLayout>
        }
      />
      <Route
        path="/login"
        element={
          <AppLayout>
            <LoginPage />
          </AppLayout>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <AppLayout>
              <DashboardPage />
            </AppLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/tests/webdev"
        element={
          <RequireAuth>
            <AppLayout>
              <TestPage track="webdev" />
            </AppLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/tests/ml"
        element={
          <RequireAuth>
            <AppLayout>
              <TestPage track="ml" />
            </AppLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/tests/result/webdev"
        element={
          <RequireAuth>
            <AppLayout>
              <TestResultPage />
            </AppLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/tests/result/ml"
        element={
          <RequireAuth>
            <AppLayout>
              <TestResultPage />
            </AppLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/recommendations"
        element={
          <RequireAuth>
            <AppLayout>
              <RecommendationsPage />
            </AppLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/docs"
        element={
          <RequireAuth>
            <AppLayout>
              <DocsPage />
            </AppLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/chat"
        element={
          <RequireAuth>
            <AppLayout>
              <ChatPage />
            </AppLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/"
        element={<Navigate to="/login" replace />}
      />
      <Route
        path="*"
        element={<Navigate to="/login" replace />}
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
