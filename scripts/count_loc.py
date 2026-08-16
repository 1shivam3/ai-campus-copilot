import os

extensions = {
    '.jsx': 'React Components & Pages',
    '.js': 'JavaScript (Utilities & Libs)',
    '.py': 'Python (FastAPI Backend & Import Scripts)',
    '.css': 'CSS Stylesheets & Design Tokens',
    '.html': 'HTML Entrypoints',
    '.md': 'Technical Documentation & Architecture',
    '.json': 'Package & Platform Configuration',
    '.webmanifest': 'PWA Web Manifest',
    '.svg': 'Custom SVG Brand Icons & Logos',
}

exclude_dirs = {'node_modules', 'venv', 'dist', '.git', '__pycache__', '.vite', '.gemini'}

stats = {ext: {'files': 0, 'lines': 0} for ext in extensions}
dir_stats = {}

total_files = 0
total_lines = 0

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

for root, dirs, files in os.walk(base_dir):
    dirs[:] = [d for d in dirs if d not in exclude_dirs]
    rel_root = os.path.relpath(root, base_dir)
    top_dir = rel_root.split(os.sep)[0] if rel_root != '.' else 'root'
    
    if top_dir not in dir_stats:
        dir_stats[top_dir] = {'files': 0, 'lines': 0}
        
    for file in files:
        ext = os.path.splitext(file)[1].lower()
        if ext in extensions:
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    count = sum(1 for _ in f)
                    stats[ext]['files'] += 1
                    stats[ext]['lines'] += count
                    dir_stats[top_dir]['files'] += 1
                    dir_stats[top_dir]['lines'] += count
                    total_files += 1
                    total_lines += count
            except Exception:
                pass

print("==================================================")
print("             COURSEPIILOT CODEBASE METRICS        ")
print("==================================================")

print("\n--- By Language / File Type ---")
for ext, info in stats.items():
    if info['files'] > 0:
        print(f"{extensions[ext]:<42} ({ext}): {info['lines']:>6,} lines in {info['files']:>2} files")

print("\n--- By Component Directory ---")
for d, s in sorted(dir_stats.items(), key=lambda x: -x[1]['lines']):
    if s['files'] > 0:
        print(f"{d + '/':<35} {s['lines']:>6,} lines across {s['files']:>2} files")

print("\n==================================================")
print(f"TOTAL CODEBASE SIZE: {total_lines:,} LINES ACROSS {total_files} FILES")
print("==================================================")
