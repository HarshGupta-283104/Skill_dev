#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class StudentSkillAssistantTester:
    def __init__(self, base_url="https://devskills-9.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.student_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test_name": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    {details}")

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict] = None, headers: Optional[Dict] = None) -> tuple[bool, Dict]:
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        
        # Default headers
        req_headers = {'Content-Type': 'application/json'}
        if self.token:
            req_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            req_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=req_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=req_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=req_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=req_headers, timeout=10)
            else:
                self.log_test(name, False, f"Unsupported method: {method}")
                return False, {}

            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}

            details = f"Status: {response.status_code} (expected {expected_status})"
            if not success:
                details += f", Response: {response.text[:200]}"
            
            self.log_test(name, success, details)
            return success, response_data

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test basic API health"""
        return self.run_test("API Health Check", "GET", "", 200)

    def test_register_student(self):
        """Test student registration"""
        timestamp = datetime.now().strftime("%H%M%S")
        test_student = {
            "name": f"Test Student {timestamp}",
            "email": f"test{timestamp}@college.edu",
            "password": "TestPass123!",
            "branch": "CSE",
            "semester": "5"
        }
        
        success, response = self.run_test(
            "Student Registration", 
            "POST", 
            "auth/register", 
            201, 
            test_student
        )
        
        if success:
            self.student_data = test_student
            return True
        return False

    def test_login_student(self):
        """Test student login"""
        if not self.student_data:
            self.log_test("Student Login", False, "No student data available for login")
            return False
            
        login_data = {
            "email": self.student_data["email"],
            "password": self.student_data["password"]
        }
        
        success, response = self.run_test(
            "Student Login",
            "POST",
            "auth/login",
            200,
            login_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            return True
        return False

    def test_get_levels(self):
        """Test getting student levels"""
        return self.run_test("Get Student Levels", "GET", "tests/levels", 200)

    def test_get_webdev_questions(self):
        """Test getting web development test questions"""
        return self.run_test("Get WebDev Questions", "GET", "tests/webdev", 200)

    def test_get_ml_questions(self):
        """Test getting ML test questions"""
        return self.run_test("Get ML Questions", "GET", "tests/ml", 200)

    def test_submit_webdev_test(self):
        """Test submitting web development test"""
        # Get questions first
        success, response = self.run_test("Get WebDev Questions for Test", "GET", "tests/webdev", 200)
        if not success or 'questions' not in response:
            return False
            
        questions = response['questions']
        # Submit answers (all option 0 for simplicity)
        answers = [{"questionId": q["id"], "optionIndex": 0} for q in questions]
        
        return self.run_test(
            "Submit WebDev Test",
            "POST",
            "tests/webdev",
            200,
            {"answers": answers}
        )

    def test_submit_ml_test(self):
        """Test submitting ML test"""
        # Get questions first
        success, response = self.run_test("Get ML Questions for Test", "GET", "tests/ml", 200)
        if not success or 'questions' not in response:
            return False
            
        questions = response['questions']
        # Submit answers (all option 1 for variety)
        answers = [{"questionId": q["id"], "optionIndex": 1} for q in questions]
        
        return self.run_test(
            "Submit ML Test",
            "POST",
            "tests/ml",
            200,
            {"answers": answers}
        )

    def test_get_recommendations(self):
        """Test getting course recommendations"""
        return self.run_test("Get Recommendations", "GET", "recommendations", 200)

    def test_get_docs(self):
        """Test getting documentation"""
        return self.run_test("Get Documentation", "GET", "docs", 200)

    def test_chat_endpoint(self):
        """Test chat functionality"""
        chat_data = {"message": "html"}
        return self.run_test("Chat with HTML query", "POST", "chat", 200, chat_data)

    def test_unauthorized_access(self):
        """Test unauthorized access handling"""
        # Temporarily remove token
        original_token = self.token
        self.token = None
        
        success, _ = self.run_test("Unauthorized Access Test", "GET", "tests/levels", 401)
        
        # Restore token
        self.token = original_token
        return success

    def run_all_tests(self):
        """Run comprehensive test suite"""
        print("🚀 Starting Student Skill Assistant API Tests")
        print(f"📍 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Basic health check
        self.test_health_check()
        
        # Auth flow
        if self.test_register_student():
            if self.test_login_student():
                # Protected endpoints (require auth)
                self.test_get_levels()
                self.test_get_webdev_questions()
                self.test_get_ml_questions()
                
                # Test submissions
                self.test_submit_webdev_test()
                self.test_submit_ml_test()
                
                # Other protected endpoints
                self.test_get_recommendations()
                self.test_get_docs()
                self.test_chat_endpoint()
                
                # Test unauthorized access
                self.test_unauthorized_access()
            else:
                print("❌ Login failed, skipping protected endpoint tests")
        else:
            print("❌ Registration failed, skipping all auth-dependent tests")
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return 1

    def get_test_report(self):
        """Get detailed test report"""
        return {
            "summary": {
                "total_tests": self.tests_run,
                "passed_tests": self.tests_passed,
                "failed_tests": self.tests_run - self.tests_passed,
                "success_rate": (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
            },
            "test_results": self.test_results,
            "timestamp": datetime.now().isoformat()
        }

def main():
    tester = StudentSkillAssistantTester()
    exit_code = tester.run_all_tests()
    
    # Save detailed report
    report = tester.get_test_report()
    with open('/app/backend_test_report.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n📄 Detailed report saved to: /app/backend_test_report.json")
    return exit_code

if __name__ == "__main__":
    sys.exit(main())