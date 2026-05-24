import pathlib
import re

def convert_file(path):
    text = path.read_text(encoding='utf-8')
    orig = text
    text = re.sub(r'^\s*const\s+dotenv\s*=\s*require\(("|\')dotenv\1\);\s*\n\s*dotenv\.config\(\);', 'import dotenv from "dotenv";\n\n dotenv.config();', text, flags=re.M)

    def repl(m):
        var = m.group(1).strip()
        module = m.group(3)
        return f'import {var} from "{module}";'

    text = re.sub(r'^\s*const\s+(\{[^}]+\}|[A-Za-z0-9_$]+)\s*=\s*require\(("|\')(.+?)\2\);', repl, text, flags=re.M)
    text = re.sub(r'^\s*module\.exports\s*=\s*\{\s*([^}]+?)\s*\};', r'export {\1};', text, flags=re.M|re.S)
    text = re.sub(r'^\s*module\.exports\s*=\s*(mongoose\.model\([^;]+?\));\s*$', r'export default \1;', text, flags=re.M)
    text = re.sub(r'^\s*module\.exports\s*=\s*([A-Za-z0-9_$]+);\s*$', r'export default \1;', text, flags=re.M)

    if path.name in ('server.js', 'db.js'):
        text = re.sub(r'mongoose\.connect\(process\.env\.MONGO_URI,\s*\{[^}]*\}\);', 'mongoose.connect(process.env.MONGO_URI, {\n  useNewUrlParser: true,\n  useUnifiedTopology: true,\n});', text, flags=re.S)
        text = re.sub(r'mongoose\.connect\(process\.env\.MONGO_URI\s*\);', 'mongoose.connect(process.env.MONGO_URI, {\n  useNewUrlParser: true,\n  useUnifiedTopology: true,\n});', text, flags=re.M)

    if text != orig:
        path.write_text(text, encoding='utf-8')
        print('updated', path)

root = pathlib.Path('.')
files = [root / 'server.js'] + sorted(root.glob('src/**/*.js'))
for path in files:
    convert_file(path)
