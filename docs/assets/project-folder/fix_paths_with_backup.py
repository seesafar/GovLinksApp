import os
import re
import shutil

# المسار الرئيسي للمشروع
project_path = "."

# الامتدادات التي نبحث فيها
extensions = [".html", ".htm"]

# الأنماط التي نريد استبدالها
patterns = [
    r'src="/?icons/',
    r'src="/?assets/icons/'
]

# البديل الصحيح
replacement = 'src="'

# مجلد النسخ الاحتياطي
backup_folder = os.path.join(project_path, "backup_before_fix")

# إنشاء مجلد النسخ الاحتياطي إن ما كان موجود
os.makedirs(backup_folder, exist_ok=True)

# المرور على جميع الملفات في المشروع
for root, dirs, files in os.walk(project_path):
    for file in files:
        if any(file.endswith(ext) for ext in extensions):
            file_path = os.path.join(root, file)
            backup_path = os.path.join(backup_folder, file)

            # عمل نسخة احتياطية قبل التعديل
            shutil.copy2(file_path, backup_path)

            # قراءة وتعديل المحتوى
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            new_content = content
            for pattern in patterns:
                new_content = re.sub(pattern, replacement, new_content)

            # حفظ التعديل لو حصل تغيير فعلاً
            if new_content != content:
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"✅ تم تعديل المسارات في: {file_path}")
                print(f"📦 تم حفظ نسخة احتياطية في: {backup_path}")
