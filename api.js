// api.js – thin wrapper around fetch → talks to the *same* page (static)
import DB from './db.js';

const API = {
  // ---------- courses ----------
  async getCourses() {
    return { ok: true, data: DB.getCourses() };
  },

  // ---------- auth ----------
  async login({ sid, password }) {
    const users = DB.getUsers();
    const user = users[sid];
    if (!user) return { ok: false, error: 'Invalid' };
    const match = await DB.compare(password, user.password);
    if (!match) return { ok: false, error: 'Invalid' };
    return { ok: true, sid, role: user.role || 'user' };
  },

  // ---------- account creation ----------
  async createAccount({ sid, password, photoPath }) {
    const users = DB.getUsers();
    const pending = DB.getPendingAccounts();

    if (users[sid] || pending.some(p => p.sid === sid)) {
      return { ok: false, error: 'Exists' };
    }

    const hash = await DB.hash(password);
    pending.push({ sid, password: hash, photoPath, status: 'pending', ts: Date.now() });
    DB.setPendingAccounts(pending);
    return { ok: true };
  },

  // ---------- admin ----------
  async getPendingAccounts() {
    return { ok: true, data: DB.getPendingAccounts() };
  },
  async approveAccount(sid) {
    const pending = DB.getPendingAccounts();
    const idx = pending.findIndex(p => p.sid === sid);
    if (idx === -1) return { ok: false };
    const item = pending.splice(idx, 1)[0];
    const users = DB.getUsers();
    users[sid] = { password: item.password, role: 'user', photoPath: item.photoPath };
    DB.setUsers(users);
    DB.setPendingAccounts(pending);
    return { ok: true };
  },
  async rejectAccount(sid) {
    const pending = DB.getPendingAccounts().filter(p => p.sid !== sid);
    DB.setPendingAccounts(pending);
    return { ok: true };
  },

  // ---------- course requests ----------
  async requestCourse({ code, title }) {
    const upper = code.toUpperCase();
    const courses = DB.getCourses();
    const pending = DB.getPendingCourses();
    if (courses[upper] || pending.some(p => p.code === upper)) {
      return { ok: false };
    }
    pending.push({ code: upper, title, status: 'pending', ts: Date.now() });
    DB.setPendingCourses(pending);
    return { ok: true };
  },

  async getPendingCourses() {
    return { ok: true, data: DB.getPendingCourses() };
  },
  async approveCourse(code) {
    const upper = code.toUpperCase();
    const pending = DB.getPendingCourses();
    const idx = pending.findIndex(p => p.code === upper);
    if (idx === -1) return { ok: false };
    const item = pending.splice(idx, 1)[0];
    const courses = DB.getCourses();
    courses[upper] = item.title;
    DB.setCourses(courses);
    DB.setPendingCourses(pending);
    return { ok: true };
  },
  async rejectCourse(code) {
    const pending = DB.getPendingCourses().filter(p => p.code !== code.toUpperCase());
    DB.setPendingCourses(pending);
    return { ok: true };
  },
};

export default API;
