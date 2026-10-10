import React, { useState, useEffect } from 'react';
import { KeyRound, User, Lock, Server, CheckCircle2, AlertTriangle, X, LogOut, Settings, RefreshCw } from 'lucide-react';
import { signIn, signOut, getSession, getCognitoConfig, saveCognitoConfig } from '../../services/auth';
import { getApiBaseUrl } from '../../services/aeroSenseApi';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, customApiUrl, setCustomApiUrl }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [userPoolId, setUserPoolId] = useState('');
  const [clientId, setClientId] = useState('');
  const [region, setRegion] = useState('ap-south-1');
  const [apiUrlInput, setApiUrlInput] = useState('');
  
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    // Load existing session & config
    const currentSession = getSession();
    setSession(currentSession);

    const config = getCognitoConfig();
    setUserPoolId(config.userPoolId);
    setClientId(config.clientId);
    setRegion(config.region || 'ap-south-1');
    setApiUrlInput(customApiUrl || getApiBaseUrl() || '');
  }, [isOpen, customApiUrl]);

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const customConfig = {
        userPoolId: userPoolId.trim(),
        clientId: clientId.trim(),
        region: region.trim(),
      };

      if (apiUrlInput.trim()) {
        if (setCustomApiUrl) setCustomApiUrl(apiUrlInput.trim());
      }

      const newSession = await signIn(username.trim(), password.trim(), customConfig);
      setSession(newSession);
      setSuccessMsg(`Successfully authenticated as ${newSession.username}`);
      if (onAuthSuccess) onAuthSuccess(newSession);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.message || 'Cognito authentication failed. Check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    signOut();
    setSession(null);
    setSuccessMsg('Signed out successfully.');
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  const handleSaveConfigOnly = (e) => {
    e.preventDefault();
    const config = {
      userPoolId: userPoolId.trim(),
      clientId: clientId.trim(),
      region: region.trim(),
    };
    saveCognitoConfig(config);
    if (apiUrlInput.trim() && setCustomApiUrl) {
      setCustomApiUrl(apiUrlInput.trim());
    }
    setSuccessMsg('AWS Configuration saved.');
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 transition-all">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">AWS Cognito Authentication</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                AeroSense Live API Security & Token Exchange
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Success Banner */}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Current Session Status */}
          {session ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-xs space-y-2">
                <div className="flex items-center justify-between font-bold text-indigo-900 dark:text-indigo-200">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Authenticated Session Active
                  </span>
                  <span className="font-mono text-[11px]">{session.username}</span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 font-mono">
                  <p className="truncate">Access Token: {session.accessToken?.substring(0, 24)}...</p>
                  <p>Region: {session.region || 'ap-south-1'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Username Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Cognito Username / Email</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. operator@aerosense.io"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              {/* Password Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Password</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              {/* Advanced AWS Endpoints Toggle */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>{showAdvanced ? 'Hide AWS Config' : 'Configure AWS API & Cognito Settings'}</span>
                </button>
              </div>

              {showAdvanced && (
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <Server className="w-3 h-3 text-emerald-500" />
                      <span>API Gateway URL (VITE_AEROSENSE_API_URL)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="https://xxxxx.execute-api.ap-south-1.amazonaws.com"
                      value={apiUrlInput}
                      onChange={(e) => setApiUrlInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">User Pool ID</label>
                      <input
                        type="text"
                        placeholder="ap-south-1_xxxxxx"
                        value={userPoolId}
                        onChange={(e) => setUserPoolId(e.target.value)}
                        className="w-full px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Client ID</label>
                      <input
                        type="text"
                        placeholder="26-character client ID"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        className="w-full px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[10px] text-slate-500 font-mono">Region: {region}</span>
                    <button
                      type="button"
                      onClick={handleSaveConfigOnly}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Save Endpoints
                    </button>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg hover:from-indigo-700 hover:to-slate-900 active:scale-95 transition disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Sign In to AWS Live</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
