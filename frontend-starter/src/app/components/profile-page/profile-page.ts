import { Component, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

/** Validation croisée : vérifie que le nouveau mot de passe et sa confirmation correspondent. */
function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  if (newPassword && confirmPassword && newPassword !== confirmPassword) {
    return { passwordMismatch: true };
  }
  return null;
}

@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
})
export class ProfilePageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // État du formulaire de nom
  readonly nameMessage = signal('');
  readonly nameError = signal('');
  readonly nameLoading = signal(false);

  // État du formulaire de mot de passe
  readonly passwordMessage = signal('');
  readonly passwordError = signal('');
  readonly passwordLoading = signal(false);

  // État de la suppression de compte
  readonly deleteError = signal('');
  readonly deleteLoading = signal(false);
  readonly showDeleteConfirm = signal(false);

  readonly nameForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
  });

  readonly passwordForm = new FormGroup(
    {
      currentPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      newPassword: new FormControl('', {
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

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.auth.profile().subscribe({
      next: (user) => {
        console.debug('[ProfilePage] Profil chargé', user.id);
        this.nameForm.setValue({ name: user.name });
      },
      error: (error) => console.error('[ProfilePage] Chargement impossible', error),
    });
  }

  saveName(): void {
    if (this.nameForm.invalid) {
      this.nameForm.markAllAsTouched();
      return;
    }

    this.nameLoading.set(true);
    this.nameMessage.set('');
    this.nameError.set('');

    const newName = this.nameForm.getRawValue().name;
    this.auth.update(newName).subscribe({
      next: (user) => {
        this.nameLoading.set(false);
        this.nameMessage.set('Nom modifié avec succès');
        console.debug('[ProfilePage] Profil enregistré', user.id);
      },
      error: (error: { error?: { message?: string } }) => {
        this.nameLoading.set(false);
        this.nameError.set(error.error?.message ?? 'Impossible de mettre à jour le nom');
        console.error('[ProfilePage] Enregistrement impossible', error);
      },
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.passwordLoading.set(true);
    this.passwordMessage.set('');
    this.passwordError.set('');

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();

    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: (response) => {
        this.passwordLoading.set(false);
        this.passwordMessage.set(response.message || 'Mot de passe modifié avec succès');
        this.passwordForm.reset();
      },
      error: (error: { status?: number; error?: { message?: string } }) => {
        this.passwordLoading.set(false);
        const msg =
          error.error?.message ||
          (error.status === 404
            ? 'Route introuvable sur le serveur. Veuillez redémarrer le backend (Ctrl+C puis npm run start).'
            : 'Échec de la modification du mot de passe');
        this.passwordError.set(msg);
        console.error('[ProfilePage] Modification du mot de passe impossible', error);
      },
    });
  }

  toggleDeleteConfirm(): void {
    this.showDeleteConfirm.update((val) => !val);
    this.deleteError.set('');
  }

  confirmDeleteAccount(): void {
    this.deleteLoading.set(true);
    this.deleteError.set('');

    this.auth.deleteAccount().subscribe({
      next: () => {
        this.deleteLoading.set(false);
        console.debug('[ProfilePage] Compte supprimé');
        void this.router.navigateByUrl('/login');
      },
      error: (error: { status?: number; error?: { message?: string } }) => {
        this.deleteLoading.set(false);
        const msg =
          error.error?.message ||
          (error.status === 404
            ? 'Route introuvable sur le serveur. Veuillez redémarrer le backend (Ctrl+C puis npm run start).'
            : 'Erreur lors de la suppression du compte');
        this.deleteError.set(msg);
        console.error('[ProfilePage] Suppression de compte impossible', error);
      },
    });
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
