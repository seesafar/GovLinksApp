# -*- coding: utf-8 -*-
"""
واجهة سطر أوامر بسيطة لمشروع GovLinksApp
- قائمة خدمات حكومية مختصرة
- فتح الرابط في المتصفح الافتراضي
- بحث سريع داخل الأسماء والوصف
"""

import os
import sys
import webbrowser

APP_NAME_AR = "رابط موحّد"
APP_NAME_EN = "GovLinksApp"

SERVICES = [
    {
        "id": 1,
        "name_ar": "وزارة الداخلية",
        "name_en": "Ministry of Interior",
        "desc_ar": "الخدمات والإشعارات التابعة لوزارة الداخلية.",
        "url": "https://www.moi.gov.sa",
    },
    {
        "id": 2,
        "name_ar": "وزارة التعليم",
        "name_en": "Ministry of Education",
        "desc_ar": "منصات وخدمات وزارة التعليم.",
        "url": "https://www.moe.gov.sa",
    },
    {
        "id": 3,
        "name_ar": "أبشر",
        "name_en": "Absher",
        "desc_ar": "الخدمات الإلكترونية لوزارة الداخلية عبر أبشر.",
        "url": "https://www.absher.sa",
    },
    {
        "id": 4,
        "name_ar": "ناجز",
        "name_en": "Najiz (Ministry of Justice)",
        "desc_ar": "الخدمات العدلية الإلكترونية.",
        "url": "https://najiz.sa",
    },
    {
        "id": 5,
        "name_ar": "توكلنا",
        "name_en": "Tawakkalna",
        "desc_ar": "منصة الخدمات الوطنية.",
        "url": "https://web.tawakkalna.sdaia.gov.sa",
    },
]

def clear():
    os.system("cls" if os.name == "nt" else "clear")

def header():
    print("===============================================")
    print(f" {APP_NAME_AR}  |  {APP_NAME_EN}")
    print("===============================================\n")

def press_to_continue():
    input("\nاضغط Enter للعودة إلى القائمة...")

def list_services(items=None):
    items = items if items is not None else SERVICES
    if not items:
        print("لا توجد نتائج لعرضها.")
        return
    for s in items:
        print(f"[{s['id']}] {s['name_ar']}  —  {s['name_en']}")
        print(f"     {s['desc_ar']}")
        print(f"     ↪ {s['url']}\n")

def open_service(service_id):
    match = next((s for s in SERVICES if s["id"] == service_id), None)
    if not match:
        print("⚠️  رقم خدمة غير صحيح.")
        return
    print(f"يفتح الآن: {match['name_ar']} — {match['name_en']}")
    webbrowser.open(match["url"], new=2)

def search_services(query):
    q = query.strip().lower()
    results = []
    for s in SERVICES:
        hay = " ".join([
            s["name_ar"], s["name_en"], s["desc_ar"], s["url"]
        ]).lower()
        if q in hay:
            results.append(s)
    return results

def main_menu():
    while True:
        clear()
        header()
        print("1) عرض جميع الخدمات")
        print("2) فتح خدمة برقمها")
        print("3) بحث عن خدمة")
        print("4) حول التطبيق")
        print("0) خروج")
        choice = input("\nاختر رقمًا: ").strip()

        if choice == "1":
            clear(); header()
            list_services()
            press_to_continue()

        elif choice == "2":
            try:
                sid = int(input("أدخل رقم الخدمة: ").strip())
                open_service(sid)
            except ValueError:
                print("⚠️  أدخل رقمًا صحيحًا.")
            press_to_continue()

        elif choice == "3":
            q = input("أدخل كلمة بحث (مثال: أبشر / interior / عدل): ").strip()
            clear(); header()
            results = search_services(q)
            if results:
                print(f"نتائج البحث عن: {q}\n")
                list_services(results)
                go = input("تريد فتح خدمة؟ اكتب رقمها أو اتركه فارغًا: ").strip()
                if go.isdigit():
                    open_service(int(go))
            else:
                print("لا توجد نتائج مطابقة.")
            press_to_continue()

        elif choice == "4":
            clear(); header()
            print("تطبيق سطر أوامر بسيط لعرض روابط الخدمات الحكومية بسرعة.")
            print("المطوّر: سفر الغامدي — Developer: Safer Al-Ghamdi")
            press_to_continue()

        elif choice == "0":
            print("\nشكراً لاستخدامك التطبيق. في أمان الله 🤍")
            sys.exit(0)

        else:
            print("⚠️  خيار غير معروف.")
            press_to_continue()

if __name__ == "__main__":
    main_menu()


# main.py
print("✅ بيئة العمل جاهزة.")
print("مشروع GovLinksApp جاهز ✅")


