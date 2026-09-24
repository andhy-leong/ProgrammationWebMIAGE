import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

/** Validation croisée : assure que le mot de passe et sa confirmation correspondent. */
function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  if (password && confirmPassword && password !== confirmPassword) {
    return { passwordMismatch: true };
  }
  return null;
}

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register-page.html',
  styleUrl: './register-page.css',
})
export class RegisterPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly error = signal('');
  readonly loading = signal(false);

  readonly form = new FormGroup(
    {
      name: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(2)],
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: [passwordMatchValidator] },
  );

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set('');

    const values = this.form.getRawValue();

    this.auth.register(values.name, values.email, values.password).subscribe({
      next: () => {
        this.loading.set(false);
        console.debug('[RegisterPage] Inscription réussie');
        void this.router.navigateByUrl('/profile');
      },
      error: (error: { status?: number; error?: { message?: string } }) => {
        this.loading.set(false);
        console.error('[RegisterPage] Échec de l’inscription', error);

        if (error.status === 409) {
          this.error.set('Cette adresse email est déjà utilisée par un autre compte.');
        } else if (error.status === 400) {
          this.error.set(
            error.error?.message ??
              'Données invalides : veuillez vérifier les informations saisies.',
          );
        } else if (error.status === 0) {
          this.error.set(
            'Impossible de joindre le serveur. Vérifiez que le backend est bien démarré.',
          );
        } else {
          this.error.set(
            error.error?.message ?? "Une erreur est survenue lors de l'inscription.",
          );
        }
      },
    });
  }
}
