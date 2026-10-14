import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pipe standalone pour formater une taille en octets en unité lisible (o, Ko, Mo).
 */
@Pipe({
  name: 'fileSize',
  standalone: true,
})
export class FileSizePipe implements PipeTransform {
  transform(bytes: number | null | undefined): string {
    if (bytes === null || bytes === undefined || isNaN(bytes) || bytes <= 0) {
      return '0 o';
    }

    if (bytes < 1024) {
      return `${bytes} o`;
    }

    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} Ko`;
    }

    const mb = kb / 1024;
    return `${mb.toFixed(2)} Mo`;
  }
}
