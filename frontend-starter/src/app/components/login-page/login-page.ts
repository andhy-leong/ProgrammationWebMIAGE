import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly error = signal('');
  readonly loading = signal(false);

  readonly form = new FormGroup({
    email: new FormControl('demo@example.com', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('Demo1234!', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set('');

    const values = this.form.getRawValue();

    this.auth.login(values.email, values.password).subscribe({
      next: () => {
        this.loading.set(false);
        console.debug('[LoginPage] Connexion réussie');
        void this.router.navigateByUrl('/tracks');
      },
      error: (error: { status?: number; error?: { message?: string } }) => {
        this.loading.set(false);
        console.error('[LoginPage] Échec de connexion', error);

        if (error.status === 401) {
          this.error.set('Identifiants incorrects (adresse email ou mot de passe invalide).');
        } else if (error.status === 0) {
          this.error.set('Impossible de joindre le serveur. Vérifiez que le backend est bien démarré.');
        } else {
          this.error.set(error.error?.message ?? 'Une erreur est survenue lors de la connexion.');
        }
      },
    });
  }
}
