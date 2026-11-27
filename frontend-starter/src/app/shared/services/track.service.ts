import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Page } from '../models/page.model';
import { Track } from '../models/track.model';

/** Encapsulates all HTTP operations for backing tracks. */
@Injectable({ providedIn: 'root' })
export class TrackService {
  private readonly http = inject(HttpClient);

  list(page = 1, limit = 5) {
    return this.http.get<Page<Track>>('/api/tracks', {
      params: { page, limit },
    });
  }

  upload(file: File, title: string, cover?: File): Observable<HttpEvent<Track>> {
    const body = new FormData();
    body.append('audio', file);
    body.append('title', title);
    if (cover) {
      body.append('cover', cover);
    }
    return this.http.post<Track>('/api/tracks', body, {
      reportProgress: true,
      observe: 'events',
    });
  }

  audio(id: string) {
    return this.http.get(`/api/tracks/${id}/audio`, {
      responseType: 'blob',
    });
  }

  cover(id: string): Observable<Blob> {
    return this.http.get(`/api/tracks/${id}/cover`, {
      responseType: 'blob',
    });
  }

  coverUrl(id: string, token?: string | null): string {
    return token ? `/api/tracks/${id}/cover?token=${encodeURIComponent(token)}` : `/api/tracks/${id}/cover`;
  }

  updateCover(id: string, file: File): Observable<Track> {
    const body = new FormData();
    body.append('cover', file);
    return this.http.put<Track>(`/api/tracks/${id}/cover`, body);
  }

  deleteCover(id: string): Observable<Track> {
    return this.http.delete<Track>(`/api/tracks/${id}/cover`);
  }

  /** Récupère toutes les pistes mises en favoris. */
  favorites(): Observable<Track[]> {
    return this.http.get<Track[]>('/api/tracks/favorites');
  }

  /** Ajoute (true) ou retire (false) une piste des favoris. */
  setFavorite(id: string, isFavorite: boolean): Observable<Track> {
    return this.http.put<Track>(`/api/tracks/${id}/favorite`, { isFavorite });
  }

  /** Renomme une piste (change son titre). */
  rename(id: string, title: string): Observable<Track> {
    return this.http.put<Track>(`/api/tracks/${id}`, { title });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/api/tracks/${id}`);
  }
}



