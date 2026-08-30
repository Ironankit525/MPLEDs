import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

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
    window.location.href = 'http://localhost:3000/';
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Unauthorized Access</h2>
        <p>You are logged in as <strong>{role}</strong>, but this dashboard requires: <strong>{allowedRoles.join(', ')}</strong>.</p>
        <button 
          onClick={() => window.location.href = 'http://localhost:3000/'}
          style={{ padding: '8px 16px', marginTop: '1rem', cursor: 'pointer' }}
        >
          Return to Auth Portal
        </button>
      </div>
    );
  }

  return <Outlet />;
}
