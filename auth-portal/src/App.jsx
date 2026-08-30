import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

const LIVE_URLS = {
  admin: 'https://sihmplads.netlify.app',
  contractor: 'https://preeminent-youtiao-fd05dd.netlify.app',
  mp: 'https://legendary-fox-513e66.netlify.app'
};

function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  // Remove domain=localhost so it works on any domain
  document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}

function handleRedirection(role, token) {
  const baseUrl = LIVE_URLS[role] || LIVE_URLS.admin;
  // Pass auth data in URL so the other Netlify domain can pick it up
  const destUrl = role === 'contractor' ? `${baseUrl}/app?token=${token}&role=${role}` : `${baseUrl}/?token=${token}&role=${role}`;
  window.location.href = destUrl;
}

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // MOCK LOGIN FOR HACKATHON DEMO (No backend needed)
      let role = 'admin';
      if (username.toLowerCase().includes('contractor')) role = 'contractor';
      if (username.toLowerCase() === 'mp') role = 'mp';
      
      const access_token = `mock_token_${role}_12345`;
      
      setCookie('auth_token', access_token, 1);
      setCookie('user_role', role, 1);
      
      handleRedirection(role, access_token);
    } catch (err) {
      setError('Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Unified Portal Login</h2>
        {error && <div className="bg-red-100 text-red-700 p-2 mb-4 rounded">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input type="text" required value={username} onChange={e => setUsername(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
          </div>
          <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
            Sign In
          </button>
        </form>
        <div className="mt-4 text-center text-sm">
          <button onClick={() => navigate('/signup')} className="text-blue-600 hover:underline">
            Don't have an account? Sign up
          </button>
        </div>
      </div>
    </div>
  );
}

function SignupPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [agency, setAgency] = useState('');
  const [district, setDistrict] = useState('');
  const [role, setRole] = useState('contractor');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/auth/register`, {
        username,
        password,
        agency_name: agency,
        district,
        role
      });
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Create Account</h2>
        {error && <div className="bg-red-100 text-red-700 p-2 mb-4 rounded">{error}</div>}
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <select value={role} onChange={e => setRole(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
              <option value="contractor">Contractor (Submitter)</option>
              <option value="mp">Member of Parliament (MP)</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input type="text" required value={username} onChange={e => setUsername(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Agency / Name</label>
            <input type="text" required value={agency} onChange={e => setAgency(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">District</label>
            <input type="text" required value={district} onChange={e => setDistrict(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
          </div>
          <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700">
            Sign Up
          </button>
        </form>
        <div className="mt-4 text-center text-sm">
          <button onClick={() => navigate('/login')} className="text-blue-600 hover:underline">
            Already have an account? Login
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
