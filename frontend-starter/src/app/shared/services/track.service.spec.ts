import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TrackService } from './track.service';
import { Page } from '../models/page.model';
import { Track } from '../models/track.model';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('TrackService', () => {
  let service: TrackService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TrackService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(TrackService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list() doit transmettre correctement les paramètres page et limit dans la requête GET /api/tracks', () => {
    const mockData: Page<Track> = {
      items: [
        {
          id: '1',
          title: 'Track A',
          originalName: 'a.mp3',
          mimeType: 'audio/mpeg',
          size: 1000,
          createdAt: '2026-10-15',
        },
      ],
      page: 2,
      limit: 5,
      pages: 4,
      total: 18,
    };

    service.list(2, 5).subscribe((res) => {
      expect(res.items.length).toBe(1);
      expect(res.page).toBe(2);
      expect(res.total).toBe(18);
    });

    const req = httpMock.expectOne((request) => request.url === '/api/tracks');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('5');

    req.flush(mockData);
  });
});
