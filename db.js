// db.js  –  pure client-side, works in any browser
const DB = {
  // keys
  USERS: 'efs_users',
  PENDING_ACCOUNTS: 'efs_pending_accounts',
  COURSES: 'efs_courses',
  PENDING_COURSES: 'efs_pending_courses',

  // helpers
  _get(key, fallback = {}) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  _set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  // ---- users -------------------------------------------------
  getUsers() { return this._get(this.USERS, {}); },
  setUsers(u) { this._set(this.USERS, u); },

  // ---- pending accounts --------------------------------------
  getPendingAccounts() { return this._get(this.PENDING_ACCOUNTS, []); },
  setPendingAccounts(a) { this._set(this.PENDING_ACCOUNTS, a); },

  // ---- courses ------------------------------------------------
  getCourses() { return this._get(this.COURSES, {}); },
  setCourses(c) { this._set(this.COURSES, c); },

  // ---- pending courses ----------------------------------------
  getPendingCourses() { return this._get(this.PENDING_COURSES, []); },
  setPendingCourses(pc) { this._set(this.PENDING_COURSES, pc); },

  // ---- password hashing (client-side) -------------------------
  async hash(pwd) {
    const bcrypt = await import('https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/dist/bcrypt.min.js');
    return bcrypt.hashSync(pwd, 12);
  },
  async compare(pwd, hash) {
    const bcrypt = await import('https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/dist/bcrypt.min.js');
    return bcrypt.compareSync(pwd, hash);
  },
};
export default DB;
