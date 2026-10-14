import { DatePipe } from '@angular/common';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Track } from '../../shared/models/track.model';
import { FileSizePipe } from '../../shared/pipes/file-size.pipe';
import { TrackService } from '../../shared/services/track.service';

@Component({
  imports: [ReactiveFormsModule, MatPaginatorModule, DatePipe, FileSizePipe],
  templateUrl: './tracks-page.html',
  styleUrl: './tracks-page.css',
})
export class TracksPageComponent implements OnDestroy {
  private readonly service = inject(TrackService);

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
  readonly deleteSuccess = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);
  readonly currentTrack = signal<Track | null>(null);
  readonly audioUrl = signal('');
  readonly title = new FormControl('', { nonNullable: true });

  file?: File;

  constructor() {
    this.load();
  }

  choose(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0];
    this.uploadSuccess.set(null);
    this.uploadError.set(null);
    this.uploadProgress.set(0);
    console.debug('[TracksPage] Fichier sélectionné', this.file?.name);
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

  upload(fileInput?: HTMLInputElement): void {
    if (!this.file || this.uploading()) return;

    this.uploading.set(true);
    this.uploadProgress.set(0);
    this.uploadSuccess.set(null);
    this.uploadError.set(null);

    const uploadedFileName = this.file.name;
    const trackTitle = this.title.value || uploadedFileName;

    this.service.upload(this.file, trackTitle).subscribe({
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
          if (fileInput) fileInput.value = '';
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

    this.deleteSuccess.set(null);
    this.deleteError.set(null);
    this.deletingTrackId.set(track.id);

    this.service.delete(track.id).subscribe({
      next: () => {
        this.deletingTrackId.set(null);
        this.deleteSuccess.set(`Le morceau « ${track.title} » a été supprimé avec succès.`);

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
        const message =
          error.status === 0
            ? 'Serveur inaccessible lors de la suppression.'
            : (error.error?.message ?? 'Impossible de supprimer la piste.');
        this.deleteError.set(message);
      },
    });
  }

  ngOnDestroy(): void {
    const url = this.audioUrl();
    if (url) {
      URL.revokeObjectURL(url);
      this.audioUrl.set('');
    }
  }
}

