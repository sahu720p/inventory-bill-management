import { authApi } from './api';
import { db, hashPassword } from '../db/db';

const SESSION_KEY = 'osv_admin_session';

export async function login(identifier, password) {
  const cleanId = (identifier || '').trim().toLowerCase();

  try {
    // 1. Try Login via MongoDB API
    const response = await authApi.login(cleanId, password);
    if (response.success && response.user) {
      const sessionData = {
        id: response.user.id || response.user._id,
        username: response.user.username,
        email: response.user.email,
        loggedInAt: new Date().toISOString(),
        token: `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
      localStorage.removeItem(SESSION_KEY);
      return sessionData;
    }
  } catch (apiError) {
    console.warn('Backend login API failed, checking local database:', apiError.message);
  }

  // 2. Fallback to Local IndexedDB in case backend is offline
  const passHash = await hashPassword(password);
  let admin = await db.admin.toCollection().first();
  if (!admin) {
    const defaultHash = await hashPassword('sahu720p');
    const id = await db.admin.add({
      username: 'omsahuvastralaya.com',
      email: 'omsahuvastralaya.com',
      passwordHash: defaultHash,
      createdAt: new Date().toISOString()
    });
    admin = await db.admin.get(id);
  }

  const validUsername = admin.username ? admin.username.toLowerCase() : 'omsahuvastralaya.com';
  if (cleanId !== 'omsahuvastralaya.com' && cleanId !== validUsername) {
    throw new Error('Invalid username or password.');
  }

  if (admin.passwordHash !== passHash) {
    throw new Error('Invalid username or password.');
  }

  const sessionData = {
    id: admin.id,
    username: admin.username,
    email: admin.email,
    loggedInAt: new Date().toISOString(),
    token: `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  };

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  localStorage.removeItem(SESSION_KEY);
  return sessionData;
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export function getCurrentUser() {
  try {
    localStorage.removeItem(SESSION_KEY);
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function isAuthenticated() {
  return getCurrentUser() !== null;
}

export async function changeAdminPassword(currentPassword, newPassword) {
  const user = getCurrentUser();
  if (!user) throw new Error('User not authenticated');

  try {
    await authApi.updatePassword(currentPassword, newPassword, user.username);
  } catch (e) {
    console.warn('Backend password update error:', e.message);
  }

  // Also update local DB
  const currentHash = await hashPassword(currentPassword);
  const admin = await db.admin.get(user.id);
  if (admin && admin.passwordHash === currentHash) {
    const newHash = await hashPassword(newPassword);
    await db.admin.update(user.id, { passwordHash: newHash });
  }

  return true;
}
