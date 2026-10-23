import os
import zipfile
import shutil

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
EXCLUDE_DIRS = {'node_modules', '.git', '__pycache__', '.vite', 'dist', '.idea', '.vscode'}
EXCLUDE_EXTS = {'.zip', '.pyc'}

public_dir = os.path.join(ROOT_DIR, 'public')
os.makedirs(public_dir, exist_ok=True)
output_zip_path = os.path.join(public_dir, 'journalier-electronique-v75.zip')
root_zip_path = os.path.join(ROOT_DIR, 'journalier-electronique-v75.zip')

if os.path.exists(output_zip_path):
    os.remove(output_zip_path)
if os.path.exists(root_zip_path):
    os.remove(root_zip_path)

file_count = 0
with zipfile.ZipFile(output_zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    for dirpath, dirnames, filenames in os.walk(ROOT_DIR):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS and d != '.git']
        for fname in sorted(filenames):
            if any(fname.endswith(ext) for ext in EXCLUDE_EXTS):
                continue
            full_path = os.path.join(dirpath, fname)
            rel_path = os.path.relpath(full_path, ROOT_DIR)
            zf.write(full_path, rel_path)
            file_count += 1

size = os.path.getsize(output_zip_path)
dist_dir = os.path.join(ROOT_DIR, 'dist')
extra_targets = [root_zip_path]
if os.path.exists(dist_dir):
    extra_targets.extend([
        os.path.join(dist_dir, 'journalier-electronique-v75.zip'),
    ])
for target in extra_targets:
    shutil.copyfile(output_zip_path, target)
print(f"ARCHIVE_READY: {file_count} fichiers archivés avec succès ({size} octets)")
