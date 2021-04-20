import { TestBed } from '@angular/core/testing';

import { NgxMatExtSelectService } from './ngx-mat-ext-select.service';

describe('NgxMatExtSelectService', () => {
  let service: NgxMatExtSelectService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NgxMatExtSelectService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
