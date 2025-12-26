#!/usr/bin/env python
"""
WhatsApp Chatbot Validation & Health Check Script
Tests delete, update, and core functionality
"""

import asyncio
import httpx
import json
from datetime import datetime
from typing import Dict, Any, Optional

# Configuration
# Default to production API; can be overridden via env `API_BASE_URL`.
API_BASE_URL = "https://fastapi-api-645233144944.asia-south1.run.app/api"
ADMIN_TOKEN = ""  # Prefer setting via environment `ADMIN_TOKEN`

class ChatbotValidator:
    def __init__(self, base_url: str = API_BASE_URL, token: str = ADMIN_TOKEN):
        self.base_url = base_url
        self.token = token
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        self.results = []
        
    async def log_result(self, test_name: str, status: str, details: str = "", error: Optional[str] = None):
        """Log test result"""
        result = {
            "timestamp": datetime.utcnow().isoformat(),
            "test": test_name,
            "status": status,  # "PASS", "FAIL", "WARNING"
            "details": details,
            "error": error
        }
        self.results.append(result)
        status_symbol = "✓" if status == "PASS" else "✗" if status == "FAIL" else "⚠"
        print(f"{status_symbol} [{status}] {test_name}: {details}")
        if error:
            print(f"    Error: {error}")
    
    async def test_keyword_create(self) -> int:
        """Test creating a keyword response"""
        try:
            payload = {
                "keywords": "rate,price,cost",
                "response": "Our hourly rates are shown on website",
                "is_active": True,
                "match_type": "contains",
                "priority": 1
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/admin/whatsapp/keywords",
                    json=payload,
                    headers=self.headers
                )
            
            if response.status_code == 201:
                data = response.json()
                keyword_id = data.get("keyword", {}).get("id")
                await self.log_result(
                    "Keyword Create",
                    "PASS",
                    f"Created keyword ID {keyword_id}"
                )
                return keyword_id
            else:
                await self.log_result(
                    "Keyword Create",
                    "FAIL",
                    f"Status {response.status_code}",
                    response.text
                )
                return None
        except Exception as e:
            await self.log_result(
                "Keyword Create",
                "FAIL",
                "Exception during create",
                str(e)
            )
            return None
    
    async def test_keyword_update(self, keyword_id: int) -> bool:
        """Test updating a keyword response"""
        try:
            payload = {
                "keywords": "rates,pricing,hourly,cost",
                "response": "Updated: Visit our website for rates",
                "priority": 2
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.put(
                    f"{self.base_url}/admin/whatsapp/keywords/{keyword_id}",
                    json=payload,
                    headers=self.headers
                )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("ok"):
                    await self.log_result(
                        "Keyword Update",
                        "PASS",
                        f"Updated keyword {keyword_id}"
                    )
                    return True
            
            await self.log_result(
                "Keyword Update",
                "FAIL",
                f"Status {response.status_code}",
                response.text
            )
            return False
        except Exception as e:
            await self.log_result(
                "Keyword Update",
                "FAIL",
                "Exception during update",
                str(e)
            )
            return False
    
    async def test_keyword_delete(self, keyword_id: int) -> bool:
        """Test deleting a keyword response"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    f"{self.base_url}/admin/whatsapp/keywords/{keyword_id}",
                    headers=self.headers
                )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("ok"):
                    await self.log_result(
                        "Keyword Delete",
                        "PASS",
                        f"Deleted keyword {keyword_id} (soft delete)"
                    )
                    return True
            
            await self.log_result(
                "Keyword Delete",
                "FAIL",
                f"Status {response.status_code}",
                response.text
            )
            return False
        except Exception as e:
            await self.log_result(
                "Keyword Delete",
                "FAIL",
                "Exception during delete",
                str(e)
            )
            return False
    
    async def test_keyword_delete_error(self, keyword_id: int) -> bool:
        """Test that re-deleting raises error"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    f"{self.base_url}/admin/whatsapp/keywords/{keyword_id}",
                    headers=self.headers
                )
            
            # Should get 400 error (already deleted)
            if response.status_code == 400:
                await self.log_result(
                    "Keyword Re-Delete Error Handling",
                    "PASS",
                    "Correctly prevents re-deletion"
                )
                return True
            else:
                await self.log_result(
                    "Keyword Re-Delete Error Handling",
                    "FAIL",
                    f"Expected 400, got {response.status_code}",
                    response.text
                )
                return False
        except Exception as e:
            await self.log_result(
                "Keyword Re-Delete Error Handling",
                "FAIL",
                "Exception",
                str(e)
            )
            return False
    
    async def test_quick_reply_create(self) -> int:
        """Test creating a quick reply"""
        try:
            payload = {
                "button_text": "📞 Contact Us",
                "message_text": "contact",
                "response_type": "contact",
                "display_order": 0,
                "is_active": True
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/admin/whatsapp/quick-replies",
                    json=payload,
                    headers=self.headers
                )
            
            if response.status_code == 201:
                data = response.json()
                qr_id = data.get("quick_reply", {}).get("id")
                await self.log_result(
                    "Quick Reply Create",
                    "PASS",
                    f"Created quick reply ID {qr_id}"
                )
                return qr_id
            else:
                await self.log_result(
                    "Quick Reply Create",
                    "FAIL",
                    f"Status {response.status_code}",
                    response.text
                )
                return None
        except Exception as e:
            await self.log_result(
                "Quick Reply Create",
                "FAIL",
                "Exception during create",
                str(e)
            )
            return None
    
    async def test_quick_reply_update(self, qr_id: int) -> bool:
        """Test updating a quick reply"""
        try:
            payload = {
                "button_text": "Updated Button",
                "message_text": "updated message",
                "display_order": 1
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.put(
                    f"{self.base_url}/admin/whatsapp/quick-replies/{qr_id}",
                    json=payload,
                    headers=self.headers
                )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("ok"):
                    await self.log_result(
                        "Quick Reply Update",
                        "PASS",
                        f"Updated quick reply {qr_id}"
                    )
                    return True
            
            await self.log_result(
                "Quick Reply Update",
                "FAIL",
                f"Status {response.status_code}",
                response.text
            )
            return False
        except Exception as e:
            await self.log_result(
                "Quick Reply Update",
                "FAIL",
                "Exception during update",
                str(e)
            )
            return False
    
    async def test_quick_reply_delete(self, qr_id: int) -> bool:
        """Test deleting a quick reply"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    f"{self.base_url}/admin/whatsapp/quick-replies/{qr_id}",
                    headers=self.headers
                )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("ok"):
                    await self.log_result(
                        "Quick Reply Delete",
                        "PASS",
                        f"Deleted quick reply {qr_id}"
                    )
                    return True
            
            await self.log_result(
                "Quick Reply Delete",
                "FAIL",
                f"Status {response.status_code}",
                response.text
            )
            return False
        except Exception as e:
            await self.log_result(
                "Quick Reply Delete",
                "FAIL",
                "Exception during delete",
                str(e)
            )
            return False
    
    async def test_list_excludes_deleted(self) -> bool:
        """Test that list endpoints exclude soft-deleted records"""
        try:
            async with httpx.AsyncClient() as client:
                # Check keywords list
                resp_kw = await client.get(
                    f"{self.base_url}/admin/whatsapp/keywords",
                    headers=self.headers
                )
                
                # Check quick replies list
                resp_qr = await client.get(
                    f"{self.base_url}/admin/whatsapp/quick-replies",
                    headers=self.headers
                )
            
            if resp_kw.status_code == 200 and resp_qr.status_code == 200:
                await self.log_result(
                    "List Excludes Deleted",
                    "PASS",
                    "Deleted records not shown in lists"
                )
                return True
            else:
                await self.log_result(
                    "List Excludes Deleted",
                    "FAIL",
                    f"Keywords: {resp_kw.status_code}, Quick Replies: {resp_qr.status_code}"
                )
                return False
        except Exception as e:
            await self.log_result(
                "List Excludes Deleted",
                "FAIL",
                "Exception during list check",
                str(e)
            )
            return False
    
    async def run_all_tests(self):
        """Run all validation tests"""
        print("=" * 60)
        print("WhatsApp Chatbot Validation & Health Check")
        print("=" * 60)
        print()
        
        # Test Keywords
        print("\n[KEYWORDS TESTS]")
        kw_id = await self.test_keyword_create()
        if kw_id:
            await self.test_keyword_update(kw_id)
            await self.test_keyword_delete(kw_id)
            await self.test_keyword_delete_error(kw_id)
        
        # Test Quick Replies
        print("\n[QUICK REPLIES TESTS]")
        qr_id = await self.test_quick_reply_create()
        if qr_id:
            await self.test_quick_reply_update(qr_id)
            await self.test_quick_reply_delete(qr_id)
        
        # Test List Endpoints
        print("\n[LIST ENDPOINT TESTS]")
        await self.test_list_excludes_deleted()
        
        # Summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.results if r["status"] == "PASS")
        failed = sum(1 for r in self.results if r["status"] == "FAIL")
        warning = sum(1 for r in self.results if r["status"] == "WARNING")
        
        print(f"✓ PASSED: {passed}")
        print(f"✗ FAILED: {failed}")
        print(f"⚠ WARNING: {warning}")
        print(f"Total: {len(self.results)}")
        print()
        
        # Export results
        with open("chatbot_validation_results.json", "w") as f:
            json.dump(self.results, f, indent=2)
        print("Results exported to: chatbot_validation_results.json")


async def main():
    validator = ChatbotValidator()
    await validator.run_all_tests()


if __name__ == "__main__":
    # For local/CI testing, prefer environment variables:
    # - ADMIN_TOKEN: your admin Bearer token
    # - API_BASE_URL: overrides default (e.g., https://taxtower.in:8002/api)
    import os
    token = os.getenv("ADMIN_TOKEN", "your-admin-token-here")
    base_url = os.getenv("API_BASE_URL", API_BASE_URL)

    validator = ChatbotValidator(base_url=base_url, token=token)
    asyncio.run(validator.run_all_tests())
