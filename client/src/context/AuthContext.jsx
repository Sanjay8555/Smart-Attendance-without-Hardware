import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { joinUserRoom } from '../services/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [student, setStudent] = useState(null);
  const [faculty, setFaculty] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('smart_attendance_token'));
  const [loading, setLoading] = useState(true);

  // Load current user profile on mount if token exists
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get('/auth/me');
        if (res.success) {
          setUser(res.user);
          setStudent(res.student);
          setFaculty(res.faculty);
          joinUserRoom(res.user.id);
        } else {
          logout();
        }
      } catch (err) {
        console.error('Failed to load user:', err);
        logout();
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.success) {
      localStorage.setItem('smart_attendance_token', res.token);
      setToken(res.token);
      setUser(res.user);
      setStudent(res.student);
      setFaculty(res.faculty);
      joinUserRoom(res.user.id);
      return res;
    }
    throw new Error(res.message || 'Login failed');
  };

  const logout = async () => {
    try {
      if (token) {
        await api.post('/auth/logout').catch(() => {});
      }
    } finally {
      localStorage.removeItem('smart_attendance_token');
      setToken(null);
      setUser(null);
      setStudent(null);
      setFaculty(null);
    }
  };

  const refreshProfile = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.success) {
        setUser(res.user);
        setStudent(res.student);
        setFaculty(res.faculty);
      }
    } catch (e) {}
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        student,
        faculty,
        token,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
        refreshProfile,
        isAdmin: user?.role === 'admin',
        isFaculty: user?.role === 'faculty',
        isStudent: user?.role === 'student',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
