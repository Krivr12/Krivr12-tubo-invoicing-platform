import type { FormEvent } from 'react';

interface LoginPageProps {
  error: string | null;
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onFillAccount: (email: string, password: string) => void;
}

export function LoginPage({
  error,
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onFillAccount,
}: LoginPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md border border-slate-200">
        <h1 className="text-2xl font-bold mb-2">Tubo Invoicing</h1>
        <p className="text-sm text-slate-500 mb-6">Sign in to manage company electronic invoices</p>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm mb-4">{error}</div>}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-slate-900 text-white py-2 rounded text-sm font-medium hover:bg-slate-800"
          >
            Sign In
          </button>
        </form>

        <div className="mt-6 pt-4 border-t text-xs text-slate-500 space-y-1">
          <p className="font-semibold">Quick Switch Demo Accounts:</p>
          <button
            onClick={() => onFillAccount('userA@alpha.com', 'password123')}
            className="text-blue-600 underline block"
          >
            Fill Company A (userA@alpha.com)
          </button>
          <button
            onClick={() => onFillAccount('userB@beta.com', 'password123')}
            className="text-blue-600 underline block"
          >
            Fill Company B (userB@beta.com)
          </button>
        </div>
      </div>
    </div>
  );
}
