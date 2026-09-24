import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AuthResponse } from '../models/auth-response.model';
import { User } from '../models/user.model';

/** Clé de stockage du token JWT dans le navigateur (localStorage). */
const TOKEN_STORAGE_KEY = 'gpc_token';

/** Handles authentication and the current user's profile. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly currentUser = signal<User | null>(null);
  readonly token = signal<string | null>(localStorage.getItem(TOKEN_STORAGE_KEY));
  readonly isAuthenticated = computed(() => !!this.token());

  /**
   * Envoie la requête POST /api/auth/login.
   * Stocke le JWT reçu et met à jour l'utilisateur courant sans jamais logger le token.
   */
  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>('/api/auth/login', { email, password })
      .pipe(tap((response) => this.storeAuthentication(response)));
  }

  /**
   * Envoie la requête POST /api/auth/register.
   * Stocke le JWT reçu et met à jour l'utilisateur courant sans jamais logger le token.
   */
  register(name: string, email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>('/api/auth/register', { name, email, password })
      .pipe(tap((response) => this.storeAuthentication(response)));
  }

  profile() {
    return this.http
      .get<User>('/api/users/me')
      .pipe(tap((user) => this.currentUser.set(user)));
  }

  update(name: string) {
    return this.http
      .put<User>('/api/users/me', { name })
      .pipe(tap((user) => this.currentUser.set(user)));
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.http.put<{ message: string }>('/api/users/me/password', {
      currentPassword,
      newPassword,
    });
  }

  deleteAccount() {
    return this.http
      .delete<{ message: string }>('/api/users/me')
      .pipe(tap(() => this.logout()));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    this.token.set(null);
    this.currentUser.set(null);
  }

  /**
   * Sauvegarde le jeton JWT dans le localStorage du navigateur et synchronise l'état réactif.
   * RÈGLE DE SÉCURITÉ TP1 : La valeur du JWT ne doit JAMAIS être imprimée dans la console
   * (console.log / console.debug / console.info) pour éviter le vol de session.
   */
  private storeAuthentication(response: AuthResponse): void {
    localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
    this.token.set(response.token);
    this.currentUser.set(response.user);
  }
}
