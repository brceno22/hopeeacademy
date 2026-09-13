import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

beforeEach(() => {
  // Los tests de sesión y de tickets leen cookies y storage: sin esto, un test
  // puede heredar el estado que dejó el anterior.
  localStorage.clear();
  sessionStorage.clear();
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
});

afterEach(() => {
  cleanup();
});
