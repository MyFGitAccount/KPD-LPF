// server.js — FULLY VERCEL-COMPATIBLE
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcrypt');
const { nanoid } = require('nanoid');
const path = require('path');
const fs = require('fs');
const DATA_DIR = path.join(__dirname, 'data');
const app = express();

// ———————— IN-MEMORY DB (NO FS) ————————
let users = {};
let pendingAccounts = [];
let courses = {};
let pendingCourses = [];

// Load data from JSON files
async function loadData() {
  const files = {
    courses: 'courses.json',
    users: 'users.json',
    pendingAccounts: 'pendingAccounts.json',
    pendingCourses: 'pendingCourses.json'
  };

  for (const [key, file] of Object.entries(files)) {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) continue;
    try {
      const raw = fs.readFileSync(filePath, 'utf8').trim();
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (key === 'courses') courses = parsed;
      else if (key === 'users') users = parsed;
      else if (key === 'pendingAccounts') pendingAccounts = parsed;
      else if (key === 'pendingCourses') pendingCourses = parsed;
    } catch (err) {
      console.warn(`Invalid JSON in ${file}:`, err.message);
    }
  }

  // Hash plain-text passwords
  for (const sid in users) {
    const user = users[sid];
    if (user.password && !user.password.startsWith('$2b$')) {
      console.log(`Hashing password for ${sid}`);
      user.password = await bcrypt.hash(user.password, 12);
    }
  }

  console.log('Data loaded + passwords hashed');
function saveData() {
  fs.writeFileSync(path.join(DATA_DIR, "users.json"), JSON.stringify(users, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, "courses.json"), JSON.stringify(courses, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, "pendingAccounts.json"), JSON.stringify(pendingAccounts, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, "pendingCourses.json"), JSON.stringify(pendingCourses, null, 2));
}

}

// ———————— MIDDLEWARE ————————
app.use(cors());
app.use((req, res, next) => { res.removeHeader("Content-Security-Policy"); next(); });
app.use(express.json({ limit: '5mb' }));

app.use((req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('X-Content-Security-Policy');
  next();
});

app.use(express.static(path.join(__dirname)));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Mainpage.html")));
const UPLOADS_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, 'uploads');
app.use('/uploads', express.static(UPLOADS_DIR));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Mainpage.html")));

app.get('/favicon.ico', (req, res) => res.status(204).end());
// ———————— MULTER ————————
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => cb(null, `${Date.now()}_${nanoid(10)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => /image\//.test(file.mimetype) ? cb(null, true) : cb(new Error('Images only')),
});
// ———————— API ROUTES ————————
app.get('/courses', (req, res) => {
  console.log('HIT: /courses →', Object.keys(courses).length);
  res.json({ ok: true, data: courses });
});

app.post('/auth/login', async (req, res) => {
  const { sid, password } = req.body || {};
  if (!sid || !password) return res.status(400).json({ ok: false, error: 'Missing' });
  const user = users[sid];
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ ok: false, error: 'Invalid' });
  res.json({ ok: true, sid, role: user.role || 'user' });
});

app.post('/accounts', upload.single('photo'), async (req, res) => {
  const { sid, password } = req.body || {};
  if (!sid || !password || !req.file) return res.status(400).json({ ok: false, error: 'Missing' });
  const hash = await bcrypt.hash(password, 12);
  if (users[sid] || pendingAccounts.some(p => p.sid === sid)) return res.status(409).json({ ok: false, error: 'Exists' });

  pendingAccounts.push({
  saveData();
    sid,
    password: hash,
    photoPath: `/uploads/${req.file.filename}`,
    status: 'pending',
    ts: Date.now()
  });
  res.json({ ok: true });
});

app.get('/accounts/check/:sid', (req, res) => {
  const sid = req.params.sid;
  const exists = !!users[sid] || !!pendingAccounts.find(p => p.sid === sid);
  res.json({ ok: true, exists, where: users[sid] ? 'users' : 'pending' });
});

app.get('/admin/pending/accounts', (req, res) => res.json({ ok: true, data: pendingAccounts }));
app.post('/admin/pending/accounts/:sid/approve', (req, res) => {
  const idx = pendingAccounts.findIndex(p => p.sid === req.params.sid);
  if (idx === -1) return res.status(404).json({ ok: false });
  const item = pendingAccounts.splice(idx, 1)[0];
  users[req.params.sid] = { password: item.password, role: 'user', photoPath: item.photoPath };
  saveData();
  res.json({ ok: true });
});
app.post('/admin/pending/accounts/:sid/reject', (req, res) => {
  pendingAccounts = pendingAccounts.filter(p => p.sid !== req.params.sid);
  saveData();
  res.json({ ok: true });
});

app.post('/courses/requests', (req, res) => {
  const { code, title } = req.body || {};
  const upper = code?.toUpperCase();
  if (!upper || !title) return res.status(400).json({ ok: false });
  if (courses[upper] || pendingCourses.some(p => p.code === upper)) return res.status(409).json({ ok: false });
  pendingCourses.push({ code: upper, title, status: 'pending', ts: Date.now() });
  res.json({ ok: true });
});

app.get('/admin/pending/courses', (req, res) => res.json({ ok: true, data: pendingCourses }));
app.post('/admin/pending/courses/:code/approve', (req, res) => {
  const upper = req.params.code.toUpperCase();
  const idx = pendingCourses.findIndex(p => p.code === upper);
  if (idx === -1) return res.status(404).json({ ok: false });
  const item = pendingCourses.splice(idx, 1)[0];
  courses[upper] = item.title;
  saveData();
  res.json({ ok: true });
});
app.post('/admin/pending/courses/:code/reject', (req, res) => {
  pendingCourses = pendingCourses.filter(p => p.code !== req.params.code.toUpperCase());
  saveData();
  res.json({ ok: true });
});
// ———————— START SERVER ————————
(async () => {
  await loadData();
  if (process.env.VERCEL) {
    module.exports = app;
  } else {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => console.log(`Local server running on ${PORT}`));
  }
})();
