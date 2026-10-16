import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { AuthResponse } from '../models/auth-response.model';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('login() doit envoyer une requête POST /api/auth/login avec le bon corps et stocker le token', () => {
    const mockResponse: AuthResponse = {
      token: 'jwt-token-test-12345',
      user: {
        id: 'user-id-1',
        name: 'Testeur',
        email: 'test@example.com',
        createdAt: '2026-10-15T12:00:00Z',
      },
    };

    service.login('test@example.com', 'password123').subscribe((res) => {
      expect(res).toEqual(mockResponse);
      expect(service.token()).toBe('jwt-token-test-12345');
      expect(service.currentUser()?.name).toBe('Testeur');
      expect(service.isAuthenticated()).toBe(true);
    });

    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      email: 'test@example.com',
      password: 'password123',
    });

    req.flush(mockResponse);
  });
});
