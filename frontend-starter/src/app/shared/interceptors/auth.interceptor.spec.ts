import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('authInterceptor', () => {
  let client: HttpClient;
  let httpMock: HttpTestingController;
  let authService: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    client = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it("doit ajouter l'en-tête Authorization: Bearer <token> lorsqu'un token est présent", () => {
    authService.token.set('mon-token-jwt-secret');

    client.get('/api/tracks').subscribe();

    const req = httpMock.expectOne('/api/tracks');
    expect(req.request.headers.has('Authorization')).toBe(true);
    expect(req.request.headers.get('Authorization')).toBe('Bearer mon-token-jwt-secret');
    req.flush([]);
  });

  it("ne doit pas ajouter l'en-tête Authorization si aucun token n'est stocké", () => {
    authService.token.set(null);

    client.get('/api/tracks').subscribe();

    const req = httpMock.expectOne('/api/tracks');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });
});
