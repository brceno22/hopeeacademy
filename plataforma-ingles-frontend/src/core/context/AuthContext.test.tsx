import { render, screen, waitFor, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/core/api/axios';
import { AuthProvider } from '@/core/context/AuthContext';
import { useAuth } from '@/core/context/auth';

vi.mock('@/core/api/axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/api/axios')>();
  return {
    ...actual,
    default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  };
});

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);
const del = vi.mocked(api.delete);

/** Expone el contexto en el DOM para poder afirmar sobre él. */
function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="admin-status">{auth.adminStatus}</span>
      <span data-testid="is-admin">{String(auth.isAdmin)}</span>
      <span data-testid="is-authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="full-name">{auth.user?.fullName ?? '-'}</span>
      <button onClick={() => void auth.loginAdmin('super-secret-admin-key').catch(() => {})}>
        login-admin
      </button>
      <button onClick={() => void auth.logoutAdmin()}>logout-admin</button>
      <button onClick={() => auth.loginStudent({ token: 't', userId: 7, fullName: 'Ana' })}>
        login-student
      </button>
      <button onClick={() => auth.logoutStudent()}>logout-student</button>
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  del.mockReset();
  get.mockRejectedValue(new Error('401'));
  post.mockResolvedValue({ data: { authenticated: true } });
  del.mockResolvedValue({ data: { authenticated: false } });
});

describe('admin session', () => {
  it('validates the HttpOnly cookie against the backend on mount', async () => {
    get.mockResolvedValue({ data: { authenticated: true } });

    renderAuth();

    await waitFor(() => {
      expect(screen.getByTestId('admin-status')).toHaveTextContent('authenticated');
    });
    expect(get).toHaveBeenCalledWith('/auth/admin/session');
  });

  it('starts as unknown so the UI can hold off instead of flashing a login', () => {
    renderAuth();

    expect(screen.getByTestId('admin-status')).toHaveTextContent('unknown');
    expect(screen.getByTestId('is-admin')).toHaveTextContent('false');
  });

  it('settles on anonymous when the backend rejects the cookie', async () => {
    renderAuth();

    await waitFor(() => {
      expect(screen.getByTestId('admin-status')).toHaveTextContent('anonymous');
    });
  });

  it('logs in by posting the key and lets the backend set the cookie', async () => {
    renderAuth();
    await waitFor(() => {
      expect(screen.getByTestId('admin-status')).toHaveTextContent('anonymous');
    });

    await userEvent.click(screen.getByText('login-admin'));

    expect(post).toHaveBeenCalledWith('/auth/admin/session', {
      key: 'super-secret-admin-key',
    });
    await waitFor(() => {
      expect(screen.getByTestId('is-admin')).toHaveTextContent('true');
    });
  });

  it('never persists the admin key in browser storage', async () => {
    renderAuth();
    await waitFor(() => {
      expect(screen.getByTestId('admin-status')).toHaveTextContent('anonymous');
    });

    await userEvent.click(screen.getByText('login-admin'));
    await waitFor(() => {
      expect(screen.getByTestId('is-admin')).toHaveTextContent('true');
    });

    const dumped = JSON.stringify({ ...localStorage, ...sessionStorage });
    expect(dumped).not.toContain('super-secret-admin-key');
    expect(localStorage.length).toBe(0);
  });

  it('stays anonymous when the key is rejected', async () => {
    post.mockRejectedValue(new Error('401'));
    renderAuth();
    await waitFor(() => {
      expect(screen.getByTestId('admin-status')).toHaveTextContent('anonymous');
    });

    await userEvent.click(screen.getByText('login-admin'));

    expect(screen.getByTestId('is-admin')).toHaveTextContent('false');
  });

  it('logs out by asking the backend to clear the cookie', async () => {
    get.mockResolvedValue({ data: { authenticated: true } });
    renderAuth();
    await waitFor(() => {
      expect(screen.getByTestId('is-admin')).toHaveTextContent('true');
    });

    await userEvent.click(screen.getByText('logout-admin'));

    expect(del).toHaveBeenCalledWith('/auth/admin/session');
    await waitFor(() => {
      expect(screen.getByTestId('admin-status')).toHaveTextContent('anonymous');
    });
  });

  it('drops admin rights locally even if the logout request fails', async () => {
    get.mockResolvedValue({ data: { authenticated: true } });
    del.mockRejectedValue(new Error('network down'));
    renderAuth();
    await waitFor(() => {
      expect(screen.getByTestId('is-admin')).toHaveTextContent('true');
    });

    await userEvent.click(screen.getByText('logout-admin'));

    await waitFor(() => {
      expect(screen.getByTestId('admin-status')).toHaveTextContent('anonymous');
    });
  });

  it('logoutAdmin never rejects, so callers can fire it from an onClick', async () => {
    del.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    await expect(result.current.logoutAdmin()).resolves.toBeUndefined();
  });
});

describe('student session', () => {
  it('restores the student from storage on mount', async () => {
    localStorage.setItem('token', 'stored-token');
    localStorage.setItem('fullName', 'Ana Gómez');

    renderAuth();

    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('full-name')).toHaveTextContent('Ana Gómez');
    await waitFor(() => {
      expect(screen.getByTestId('admin-status')).toHaveTextContent('anonymous');
    });
  });

  it('persists the Moodle token and profile on login', async () => {
    renderAuth();

    await userEvent.click(screen.getByText('login-student'));

    expect(localStorage.getItem('token')).toBe('t');
    expect(localStorage.getItem('moodleUserId')).toBe('7');
    expect(localStorage.getItem('fullName')).toBe('Ana');
    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');
  });

  it('clears the stored session on logout', async () => {
    renderAuth();
    await userEvent.click(screen.getByText('login-student'));

    await userEvent.click(screen.getByText('logout-student'));

    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
  });

  it('does not grant admin rights to a logged-in student', async () => {
    renderAuth();
    await userEvent.click(screen.getByText('login-student'));

    await waitFor(() => {
      expect(screen.getByTestId('admin-status')).toHaveTextContent('anonymous');
    });
    expect(screen.getByTestId('is-admin')).toHaveTextContent('false');
  });
});

describe('useAuth', () => {
  it('fails loudly when used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow(/AuthProvider/);

    spy.mockRestore();
  });
});
