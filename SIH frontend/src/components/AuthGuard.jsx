import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}

// Snatch token from URL synchronously before React Router redirects
if (typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token');
  const urlRole = params.get('role');
  if (urlToken) {
    setCookie('auth_token', urlToken, 1);
    setCookie('user_role', urlRole, 1);
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

export function AuthGuard({ allowedRoles }) {
  const token = getCookie('auth_token');
  const role = getCookie('user_role');

  if (!token) {
    window.location.href = 'https://inspiring-lebkuchen-67d55f.netlify.app/';
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Unauthorized Access</h2>
        <p>You are logged in as <strong>{role}</strong>, but this dashboard requires: <strong>{allowedRoles.join(', ')}</strong>.</p>
        <button 
          onClick={() => window.location.href = 'https://inspiring-lebkuchen-67d55f.netlify.app/'}
          style={{ padding: '8px 16px', marginTop: '1rem', cursor: 'pointer' }}
        >
          Return to Auth Portal
        </button>
      </div>
    );
  }

  return <Outlet />;
}
