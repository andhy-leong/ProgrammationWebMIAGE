import { DatePipe } from '@angular/common';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { Component, computed, ElementRef, inject, OnDestroy, signal, viewChild } from '@angular/core';
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
  // Écoute la touche Espace sur toute la page et appelle onSpaceKey()
  host: {
    '(document:keydown.space)': 'onSpaceKey($event)',
  },
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
  // Identifiant de la piste en cours de renommage (pour afficher ⏳ sur son bouton)
  readonly renamingTrackId = signal<string | null>(null);

  // Liste des pistes mises en favoris (affichée dans la section « Mes favoris »)
  readonly favorites = signal<Track[]>([]);
  readonly currentTrack = signal<Track | null>(null);
  readonly audioUrl = signal('');

  // Vitesses de lecture proposées (de x0.25 à x2.5)
  readonly speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5];
  // Vitesse choisie actuellement (x1 = vitesse normale)
  readonly playbackSpeed = signal(1);

  // Mode de répétition :
  // 'none' = pas de répétition, 'one' = répéter la musique, 'all' = répéter la playlist
  readonly repeatMode = signal('none');

  // Liste de lecture
  // originalList : les pistes dans l'ordre normal
  // playlist : les pistes dans l'ordre où elles seront jouées (mélangées si « Aléatoire » est activé)
  readonly originalList = signal<Track[]>([]);
  readonly playlist = signal<Track[]>([]);
  // true quand on a cliqué sur « Tout lire » : les pistes s'enchaînent jusqu'à la fin
  readonly playingAll = signal(false);
  // true quand la lecture aléatoire est activée
  readonly shuffle = signal(false);
  // true quand la lecture automatique est activée : à la fin d'une piste, la suivante démarre
  readonly autoNext = signal(true);

  // Accès à la balise <audio #player> du HTML (pour la touche Espace)
  readonly player = viewChild<ElementRef<HTMLAudioElement>>('player');

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
    this.loadFavorites();
  }

  // Charge la liste des favoris depuis le serveur
  loadFavorites(): void {
    this.service.favorites().subscribe({
      next: (list) => this.favorites.set(list),
      error: (error) => console.error('[TracksPage] Chargement des favoris impossible', error),
    });
  }

  // Appelée quand l'utilisateur clique sur l'étoile ☆ / ★
  toggleFavorite(track: Track): void {
    // Si la piste est déjà en favoris, on la retire. Sinon, on l'ajoute.
    const newValue = !track.isFavorite;

    this.service.setFavorite(track.id, newValue).subscribe({
      next: () => {
        // On met à jour l'étoile dans la liste « Mes pistes »
        this.tracks.update((list) =>
          list.map((t) => (t.id === track.id ? { ...t, isFavorite: newValue } : t))
        );
        // On recharge la section « Mes favoris »
        this.loadFavorites();
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Favori impossible', error);
        const message = error.error?.message ?? 'Impossible de modifier les favoris.';
        this.snackBar.open(message, 'Fermer', { duration: 4000 });
      },
    });
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

        this.loadFavorites(); // la nouvelle pochette s'affiche aussi dans « Mes favoris »
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

        this.loadFavorites(); // l'image par défaut s'affiche aussi dans « Mes favoris »
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
    this.title.disable();

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
          this.title.enable();
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
        this.title.enable();
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

  // Appelée quand l'utilisateur choisit une vitesse dans la liste
  changeSpeed(event: Event, player: HTMLAudioElement): void {
    const select = event.target as HTMLSelectElement;
    const speed = Number(select.value);
    this.playbackSpeed.set(speed);
    player.playbackRate = speed;
  }

  // Appelée quand une nouvelle piste est chargée :
  // le navigateur remet la vitesse à x1, donc on remet la vitesse choisie
  applySpeed(player: HTMLAudioElement): void {
    player.playbackRate = this.playbackSpeed();
  }

  // Appelée quand l'utilisateur choisit un mode de répétition
  changeRepeatMode(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.repeatMode.set(select.value);
  }

  // Bouton « Tout lire » : lit toute la liste à la suite
  playAll(list: Track[]): void {
    if (list.length === 0) {
      return;
    }
    this.playingAll.set(true);
    this.originalList.set(list);
    this.buildPlaylist(null);
    this.play(this.playlist()[0]);
  }

  // Bouton ▶ d'une piste : lit cette piste.
  // On garde quand même la liste, pour le mode « Répéter la playlist ».
  playOne(track: Track, list: Track[]): void {
    this.playingAll.set(false);
    this.originalList.set(list);
    this.buildPlaylist(track);
    this.play(track);
  }

  // Bouton « Aléatoire » : active ou désactive la lecture aléatoire
  toggleShuffle(): void {
    this.shuffle.set(!this.shuffle());
    // On refait l'ordre de lecture, en gardant la piste en cours comme point de départ
    this.buildPlaylist(this.currentTrack());
  }

  // Prépare l'ordre de lecture à partir de originalList.
  // firstTrack : la piste qui doit être jouée en premier en mode aléatoire (ou null)
  private buildPlaylist(firstTrack: Track | null): void {
    const list = this.originalList();

    // Lecture normale : on garde l'ordre de la liste
    if (!this.shuffle() || list.length === 0) {
      this.playlist.set([...list]);
      return;
    }

    // Lecture aléatoire : on mélange la liste
    const mixed = this.shuffleList(list);

    // On met firstTrack au début de la liste mélangée
    if (firstTrack) {
      const index = mixed.findIndex((t) => t.id === firstTrack.id);
      if (index !== -1) {
        mixed.splice(index, 1); // on l'enlève de sa place
        mixed.unshift(firstTrack); // on la remet au début
      }
    }

    this.playlist.set(mixed);
  }

  // Renvoie une copie mélangée de la liste (méthode de « Fisher-Yates »)
  private shuffleList(list: Track[]): Track[] {
    const copy = [...list];
    // On part de la fin, et on échange chaque piste avec une piste prise au hasard avant elle
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); // nombre au hasard entre 0 et i
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  // Case à cocher « Lecture automatique »
  changeAutoNext(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.autoNext.set(checkbox.checked);
  }

  // Touche Espace : met en pause ou relance la musique
  onSpaceKey(event: Event): void {
    const target = event.target as HTMLElement;

    // Si on écrit dans un champ (ex : la recherche), Espace doit écrire un espace normalement.
    // Si la barre audio a le focus, le navigateur gère déjà Espace tout seul.
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.tagName === 'AUDIO') {
      return;
    }

    const audio = this.player()?.nativeElement;
    if (!audio) {
      return; // aucune musique lancée
    }

    // Empêche le défilement de la page et le « clic » sur le dernier bouton cliqué
    event.preventDefault();

    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  }

  // Bouton ⏹ : arrête complètement la lecture et ferme le lecteur
  stopAll(): void {
    // On libère le fichier audio gardé en mémoire par le navigateur
    const url = this.audioUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }

    // Quand audioUrl est vide, le lecteur disparaît de la page, donc le son s'arrête
    this.audioUrl.set('');
    this.currentTrack.set(null);

    // On arrête aussi l'enchaînement « Tout lire »
    this.playingAll.set(false);
  }

  // Bouton ⏭ : passe à la piste suivante de la liste de lecture
  nextTrack(): void {
    const list = this.playlist();
    if (list.length === 0) {
      return;
    }

    const currentIndex = list.findIndex((t) => t.id === this.currentTrack()?.id);
    let nextIndex = currentIndex + 1;

    // Après la dernière piste, on revient à la première
    if (nextIndex >= list.length) {
      nextIndex = 0;
    }

    this.play(list[nextIndex]);
  }

  // Bouton ⏮ : revient à la piste précédente de la liste de lecture
  previousTrack(): void {
    const list = this.playlist();
    if (list.length === 0) {
      return;
    }

    const currentIndex = list.findIndex((t) => t.id === this.currentTrack()?.id);
    let previousIndex = currentIndex - 1;

    // Avant la première piste, on va à la dernière
    if (previousIndex < 0) {
      previousIndex = list.length - 1;
    }

    this.play(list[previousIndex]);
  }

  // Appelée quand une musique est terminée
  // (en mode 'one', elle n'est jamais appelée car le navigateur relance la musique tout seul)
  onTrackEnded(): void {
    // Ni « Tout lire », ni « Répéter la playlist », ni « Lecture automatique » :
    // on s'arrête après cette piste
    if (!this.playingAll() && this.repeatMode() !== 'all' && !this.autoNext()) {
      return;
    }

    if (this.playlist().length === 0) {
      return;
    }

    // On cherche la position de la musique qui vient de se terminer
    const currentIndex = this.playlist().findIndex((t) => t.id === this.currentTrack()?.id);
    let nextIndex = currentIndex + 1;

    // C'était la dernière piste de la liste
    if (nextIndex >= this.playlist().length) {
      if (this.repeatMode() !== 'all') {
        this.playingAll.set(false); // fin de la lecture
        return;
      }
      // « Répéter la playlist » : on recommence au début
      nextIndex = 0;
      // En aléatoire, on mélange à nouveau pour que le nouveau tour soit différent
      if (this.shuffle()) {
        this.buildPlaylist(null);
      }
    }

    this.play(this.playlist()[nextIndex]);
  }

  // Appelée quand l'utilisateur clique sur « Renommer »
  renameTrack(track: Track): void {
    // On ouvre une petite fenêtre qui propose l'ancien titre
    const newTitle = window.prompt('Nouveau titre :', track.title);

    // L'utilisateur a cliqué sur « Annuler »
    if (newTitle === null) {
      return;
    }

    // On enlève les espaces au début et à la fin
    const title = newTitle.trim();

    if (title === '') {
      this.snackBar.open('Le titre ne peut pas être vide.', 'Fermer', { duration: 3500 });
      return;
    }

    // Rien n'a changé : inutile d'appeler le serveur
    if (title === track.title) {
      return;
    }

    this.renamingTrackId.set(track.id);

    this.service.rename(track.id, title).subscribe({
      next: () => {
        // On met à jour le titre dans la liste affichée
        this.tracks.update((list) =>
          list.map((t) => (t.id === track.id ? { ...t, title: title } : t))
        );

        // Si cette piste est en cours de lecture, on met aussi à jour le lecteur
        if (this.currentTrack()?.id === track.id) {
          this.currentTrack.update((current) => (current ? { ...current, title: title } : null));
        }

        this.renamingTrackId.set(null);
        this.loadFavorites(); // le titre change aussi dans « Mes favoris »
        this.snackBar.open(`Piste renommée en « ${title} ».`, 'Fermer', { duration: 3500 });
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Renommage impossible', error);
        this.renamingTrackId.set(null);
        const message = error.error?.message ?? 'Impossible de renommer la piste.';
        this.snackBar.open(message, 'Fermer', { duration: 4000 });
      },
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
        this.loadFavorites(); // la piste supprimée disparaît aussi de « Mes favoris »

        // On retire aussi la piste de la liste de lecture
        this.originalList.update((list) => list.filter((t) => t.id !== track.id));
        this.playlist.update((list) => list.filter((t) => t.id !== track.id));
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


