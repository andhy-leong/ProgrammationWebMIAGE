import { DatePipe } from '@angular/common';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Track } from '../../shared/models/track.model';
import { FileSizePipe } from '../../shared/pipes/file-size.pipe';
import { AuthService } from '../../shared/services/auth.service';
import { TrackService } from '../../shared/services/track.service';

@Component({
  imports: [ReactiveFormsModule, MatPaginatorModule, MatSnackBarModule, DatePipe, FileSizePipe],
  templateUrl: './tracks-page.html',
  styleUrl: './tracks-page.css',
})
export class TracksPageComponent implements OnDestroy {
  private readonly service = inject(TrackService);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);


  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly total = signal(0);
  readonly limit = signal(5);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly uploading = signal(false);
  readonly uploadProgress = signal(0);
  readonly uploadSuccess = signal<string | null>(null);
  readonly uploadError = signal<string | null>(null);
  readonly deletingTrackId = signal<string | null>(null);
  readonly currentTrack = signal<Track | null>(null);
  readonly audioUrl = signal('');
  readonly title = new FormControl('', { nonNullable: true });

  coverFile?: File;
  readonly coverPreviewUrl = signal<string | null>(null);


  // Signaux de filtrage et tri
  readonly searchFilter = signal('');
  readonly sortBy = signal<'date-desc' | 'date-asc' | 'title-asc' | 'title-desc' | 'size-asc' | 'size-desc'>('date-desc');
  readonly sizeFilter = signal<'all' | 'small' | 'medium' | 'large'>('all');

  readonly hasActiveFilters = computed(() => {
    return this.searchFilter().trim().length > 0 || this.sortBy() !== 'date-desc' || this.sizeFilter() !== 'all';
  });

  readonly filteredTracks = computed(() => {
    const query = this.searchFilter().trim().toLowerCase();
    const sort = this.sortBy();
    const size = this.sizeFilter();

    let result = [...this.tracks()];

    // 1. Filtrage textuel (titre et nom original du fichier)
    if (query) {
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.originalName.toLowerCase().includes(query)
      );
    }

    // 2. Filtrage par tranche de taille
    if (size === 'small') {
      result = result.filter((t) => t.size < 1024 * 1024);
    } else if (size === 'medium') {
      result = result.filter((t) => t.size >= 1024 * 1024 && t.size <= 5 * 1024 * 1024);
    } else if (size === 'large') {
      result = result.filter((t) => t.size > 5 * 1024 * 1024);
    }

    // 3. Tri
    result.sort((a, b) => {
      switch (sort) {
        case 'title-asc':
          return a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
        case 'title-desc':
          return b.title.localeCompare(a.title, 'fr', { sensitivity: 'base' });
        case 'size-asc':
          return a.size - b.size;
        case 'size-desc':
          return b.size - a.size;
        case 'date-asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'date-desc':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return result;
  });

  file?: File;

  constructor() {
    this.load();
  }

  setSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchFilter.set(input.value);
  }

  setSort(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.sortBy.set(select.value as any);
  }

  setSizeFilter(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.sizeFilter.set(select.value as any);
  }

  resetFilters(): void {
    this.searchFilter.set('');
    this.sortBy.set('date-desc');
    this.sizeFilter.set('all');
  }


  choose(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0];
    this.uploadSuccess.set(null);
    this.uploadError.set(null);
    this.uploadProgress.set(0);
    console.debug('[TracksPage] Fichier sélectionné', this.file?.name);
  }

  chooseCover(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.coverFile = input.files?.[0];
    const oldUrl = this.coverPreviewUrl();
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    if (this.coverFile) {
      this.coverPreviewUrl.set(URL.createObjectURL(this.coverFile));
    } else {
      this.coverPreviewUrl.set(null);
    }
    console.debug('[TracksPage] Image de couverture sélectionnée', this.coverFile?.name);
  }

  readonly coverMessage = signal<string | null>(null);
  readonly coverError = signal<string | null>(null);
  readonly updatingCoverTrackId = signal<string | null>(null);
  readonly coverVersion = signal<Record<string, number>>({});

  getTrackCoverUrl(track: Track): string {
    if (track.hasCover) {
      const v = this.coverVersion()[track.id] || 0;
      const baseUrl = this.service.coverUrl(track.id, this.auth.token());
      return v > 0 ? `${baseUrl}&v=${v}` : baseUrl;
    }
    return '/default-cover.svg';
  }

  onCoverChangeForTrack(event: Event, track: Track): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.coverError.set('Veuillez sélectionner un fichier image valide (PNG, JPEG, WebP).');
      input.value = '';
      return;
    }

    this.coverMessage.set(null);
    this.coverError.set(null);
    this.updatingCoverTrackId.set(track.id);

    this.service.updateCover(track.id, file).subscribe({
      next: (updatedTrack) => {
        // Mise à jour immédiate et réactive du signal de la liste
        this.tracks.update((list) =>
          list.map((t) => (t.id === track.id ? { ...t, hasCover: true } : t))
        );
        // Force le rechargement immédiat de l'image par cache-busting
        this.coverVersion.update((v) => ({ ...v, [track.id]: Date.now() }));

        // Synchroniser le lecteur si ce morceau est actuellement en lecture
        if (this.currentTrack()?.id === track.id) {
          this.currentTrack.update((current) => (current ? { ...current, hasCover: true } : null));
        }

        this.coverMessage.set(`L'image de couverture du morceau « ${track.title} » a été mise à jour.`);
        this.updatingCoverTrackId.set(null);
        input.value = '';
      },
      error: (err: HttpErrorResponse) => {
        console.error('[TracksPage] Erreur de mise à jour de pochette', err);
        this.coverError.set(err.error?.message ?? 'Impossible de mettre à jour l\'image de couverture.');
        this.updatingCoverTrackId.set(null);
        input.value = '';
      },
    });
  }

  removeCoverForTrack(track: Track, event?: Event): void {
    event?.stopPropagation();
    if (!track.hasCover) return;
    if (!window.confirm(`Supprimer l'image de couverture personnalisée du morceau « ${track.title} » ? L'image par défaut sera rétablie.`)) {
      return;
    }

    this.coverMessage.set(null);
    this.coverError.set(null);
    this.updatingCoverTrackId.set(track.id);

    this.service.deleteCover(track.id).subscribe({
      next: () => {
        // Rétablir immédiatement l'indicateur hasCover: false
        this.tracks.update((list) =>
          list.map((t) => (t.id === track.id ? { ...t, hasCover: false } : t))
        );
        // Mettre à jour la version pour forcer l'affichage du default-cover.svg
        this.coverVersion.update((v) => ({ ...v, [track.id]: Date.now() }));

        // Synchroniser le lecteur si ce morceau est actuellement en lecture
        if (this.currentTrack()?.id === track.id) {
          this.currentTrack.update((current) => (current ? { ...current, hasCover: false } : null));
        }

        this.coverMessage.set(`L'image personnalisée de « ${track.title} » a été supprimée (image par défaut rétablie).`);
        this.updatingCoverTrackId.set(null);
      },
      error: (err: HttpErrorResponse) => {
        console.error('[TracksPage] Erreur de suppression de pochette', err);
        this.coverError.set(err.error?.message ?? 'Impossible de supprimer l\'image de couverture.');
        this.updatingCoverTrackId.set(null);
      },
    });
  }


  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.list(this.page(), this.limit()).subscribe({
      next: (response) => {
        console.debug('[TracksPage] Pistes chargées', response.items.length);
        this.tracks.set(response.items);
        this.pages.set(response.pages);
        this.total.set(response.total);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Chargement impossible', error);
        const message =
          error.status === 0
            ? 'Serveur inaccessible. Vérifiez votre connexion ou l’état du backend.'
            : (error.error?.message ?? 'Impossible de charger les pistes depuis le serveur.');
        this.error.set(message);
        this.loading.set(false);
      },
    });
  }

  onPageChange(event: PageEvent): void {
    this.limit.set(event.pageSize);
    this.page.set(event.pageIndex + 1);
    this.load();
  }

  go(page: number): void {
    if (page < 1 || (this.pages() > 0 && page > this.pages())) {
      return;
    }
    this.page.set(page);
    this.load();
  }

  upload(fileInput?: HTMLInputElement, coverInput?: HTMLInputElement): void {
    if (!this.file || this.uploading()) return;

    this.uploading.set(true);
    this.uploadProgress.set(0);
    this.uploadSuccess.set(null);
    this.uploadError.set(null);

    const uploadedFileName = this.file.name;
    const trackTitle = this.title.value || uploadedFileName;

    this.service.upload(this.file, trackTitle, this.coverFile).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          const progress = Math.round((100 * event.loaded) / event.total);
          this.uploadProgress.set(progress);
        } else if (event.type === HttpEventType.Response) {
          const track = event.body;
          console.debug('[TracksPage] Piste envoyée', track?.id);
          this.uploadProgress.set(100);
          this.uploading.set(false);
          this.uploadSuccess.set(`Piste « ${track?.title ?? trackTitle} » importée avec succès.`);
          this.title.setValue('');
          this.file = undefined;
          this.coverFile = undefined;
          const oldPreview = this.coverPreviewUrl();
          if (oldPreview) URL.revokeObjectURL(oldPreview);
          this.coverPreviewUrl.set(null);
          if (fileInput) fileInput.value = '';
          if (coverInput) coverInput.value = '';
          this.page.set(1);
          this.load();
        }
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Envoi impossible', error);
        this.uploading.set(false);
        this.uploadProgress.set(0);
        const message =
          error.status === 0
            ? 'Serveur inaccessible lors du téléversement.'
            : (error.error?.message ?? "Erreur lors de l'envoi de la piste.");
        this.uploadError.set(message);
      },
    });
  }

  play(track: Track): void {
    this.service.audio(track.id).subscribe({
      next: (blob) => {
        console.debug('[TracksPage] Audio chargé', track.id);
        const previousUrl = this.audioUrl();
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        this.audioUrl.set(URL.createObjectURL(blob));
        this.currentTrack.set(track);
      },
      error: (error) => console.error('[TracksPage] Lecture impossible', error),
    });
  }

  deleteTrack(track: Track): void {
    const confirmed = window.confirm(`Voulez-vous vraiment supprimer le morceau « ${track.title} » ?`);
    if (!confirmed) return;

    this.deletingTrackId.set(track.id);

    this.service.delete(track.id).subscribe({
      next: () => {
        this.deletingTrackId.set(null);
        this.snackBar.open(`Le morceau « ${track.title} » a été supprimé avec succès.`, 'Fermer', {
          duration: 3500,
          panelClass: ['snackbar-success'],
        });

        // Si la piste supprimée est en cours de lecture, stopper le lecteur et libérer l'ObjectURL
        if (this.currentTrack()?.id === track.id) {
          const url = this.audioUrl();
          if (url) {
            URL.revokeObjectURL(url);
            this.audioUrl.set('');
          }
          this.currentTrack.set(null);
        }

        // Limite de pagination : si la dernière piste d'une page > 1 est supprimée, revenir à la page précédente
        if (this.tracks().length === 1 && this.page() > 1) {
          this.page.update((p) => p - 1);
        }
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Suppression impossible', error);
        this.deletingTrackId.set(null);

        // Si la piste supprimée est en cours de lecture, réinitialiser le lecteur audio
        if (this.currentTrack()?.id === track.id) {
          const url = this.audioUrl();
          if (url) {
            URL.revokeObjectURL(url);
            this.audioUrl.set('');
          }
          this.currentTrack.set(null);
        }

        if (error.status === 404) {
          this.snackBar.open(
            `Cette piste n'existe plus ou a déjà été supprimée (par exemple dans un autre onglet).`,
            'Fermer',
            {
              duration: 5000,
              panelClass: ['snackbar-error'],
            }
          );
          // Rafraîchir la liste pour synchroniser l'affichage
          this.load();
        } else {
          const message =
            error.status === 0
              ? 'Serveur inaccessible lors de la suppression.'
              : (error.error?.message ?? 'Impossible de supprimer la piste.');
          this.snackBar.open(message, 'Fermer', {
            duration: 4000,
            panelClass: ['snackbar-error'],
          });
        }
      },
    });
  }

  ngOnDestroy(): void {
    const url = this.audioUrl();
    if (url) {
      URL.revokeObjectURL(url);
      this.audioUrl.set('');
    }
    const coverUrl = this.coverPreviewUrl();
    if (coverUrl) {
      URL.revokeObjectURL(coverUrl);
      this.coverPreviewUrl.set(null);
    }
  }
}


